 use wasm_bindgen::prelude::*;
 use wasm_bindgen_futures::spawn_local;
 use js_sys::Function;
 use std::sync::atomic::{AtomicBool, Ordering};
 use once_cell::sync::OnceCell;
 use bytemuck::{Pod, Zeroable};

 #[cfg(feature = "gpu")]
 use wgpu;

 #[cfg(feature = "gpu")]
 #[repr(C)]
 #[derive(Clone, Copy)]
 struct Params {
     target: u32,
     base_nonce: u32,
 }
 #[cfg(feature = "gpu")]
 unsafe impl Zeroable for Params {}
 #[cfg(feature = "gpu")]
 unsafe impl Pod for Params {}

 #[cfg(feature = "gpu")]
 struct GpuContext {
     device: wgpu::Device,
     queue: wgpu::Queue,
     pipeline: wgpu::ComputePipeline,
     msg_buffer: wgpu::Buffer,
     param_buffer: wgpu::Buffer,
     result_buffer: wgpu::Buffer,
     workgroup_size: u32,
 }

 static ABORT_FLAG: AtomicBool = AtomicBool::new(false);
 static GPU_CTX: OnceCell<GpuContext> = OnceCell::new();

 /// Initialize WebGPU (GPU) context. Falls back silently if feature "gpu" disabled.
 #[wasm_bindgen]
 pub async fn init() -> Result<(), JsValue> {
     console_error_panic_hook::set_once();
     #[cfg(feature = "gpu")]
     {
         let instance = wgpu::Instance::new(wgpu::Backends::all());
         let adapter = instance
             .request_adapter(&wgpu::RequestAdapterOptions {
                 power_preference: wgpu::PowerPreference::HighPerformance,
                 compatible_surface: None,
                 force_fallback_adapter: false,
             })
             .await
             .ok_or_else(|| JsValue::from_str("No WebGPU adapter found"))?;
         let (device, queue) = adapter
             .request_device(
                 &wgpu::DeviceDescriptor {
                     label: None,
                     features: wgpu::Features::empty(),
                     limits: wgpu::Limits::default(),
                 },
                 None,
             )
             .await
             .map_err(|e| JsValue::from_str(&format!("Failed to request device: {:?}", e)))?;
         let shader = device.create_shader_module(&wgpu::ShaderModuleDescriptor {
             label: Some("blake3_pow_shader"),
             source: wgpu::ShaderSource::Wgsl(include_str!("shader.wgsl").into()),
         });
         let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
             label: Some("blake3_pow_pipeline"),
             layout: None,
             module: &shader,
             entry_point: "main",
         });
         let workgroup_size = 64;
         let msg_buffer = device.create_buffer(&wgpu::BufferDescriptor {
             label: Some("message_buffer"),
             size: (16 * 4) as u64,
             usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
             mapped_at_creation: false,
         });
         let param_buffer = device.create_buffer(&wgpu::BufferDescriptor {
             label: Some("param_buffer"),
             size: std::mem::size_of::<Params>() as u64,
             usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
             mapped_at_creation: false,
         });
         let result_buffer = device.create_buffer(&wgpu::BufferDescriptor {
             label: Some("result_buffer"),
             size: 8,
             usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
             mapped_at_creation: false,
         });
         GPU_CTX
             .set(GpuContext {
                 device,
                 queue,
                 pipeline,
                 msg_buffer,
                 param_buffer,
                 result_buffer,
                 workgroup_size,
             })
             .map_err(|_| JsValue::from_str("GPU context already initialized"))?;
     }
     Ok(())
 }

 /// Start mining: searches for a nonce such that BLAKE3(work||nonce) <= target.
 /// Calls `cb(nonce)` when found. Returns immediately; call `stop()` to cancel.
 #[wasm_bindgen]
 pub async fn start_mining(work: &[u8], target: u32, cb: &Function) -> Result<(), JsValue> {
     ABORT_FLAG.store(false, Ordering::SeqCst);
     #[cfg(feature = "gpu")]
     {
         let ctx = GPU_CTX.get().ok_or_else(|| JsValue::from_str("GPU not initialized"))?;
         if work.len() > 60 {
             return Err(JsValue::from_str("work length must be <= 60 bytes for GPU mode"));
         }
         // pack work bytes into 16 u32 words
         let mut msg_words = [0u32; 16];
         for (i, &b) in work.iter().enumerate() {
             let idx = i / 4;
             let shift = (i % 4) * 8;
             msg_words[idx] |= (b as u32) << shift;
         }
         ctx.queue.write_buffer(&ctx.msg_buffer, 0, bytemuck::cast_slice(&msg_words));
         let batch_size: u32 = 1_000_000;
         let workgroups = (batch_size + ctx.workgroup_size - 1) / ctx.workgroup_size;
         let bind_group_layout = ctx.pipeline.get_bind_group_layout(0);
         let bind_group = ctx.device.create_bind_group(&wgpu::BindGroupDescriptor {
             layout: &bind_group_layout,
             entries: &[
                 wgpu::BindGroupEntry {
                     binding: 0,
                     resource: ctx.param_buffer.as_entire_binding(),
                 },
                 wgpu::BindGroupEntry {
                     binding: 1,
                     resource: ctx.msg_buffer.as_entire_binding(),
                 },
                 wgpu::BindGroupEntry {
                     binding: 2,
                     resource: ctx.result_buffer.as_entire_binding(),
                 },
             ],
             label: Some("pow_bind_group"),
         });
         let mut base_nonce: u32 = 0;
         loop {
             if ABORT_FLAG.load(Ordering::SeqCst) {
                 break;
             }
             let params = Params { target, base_nonce };
             ctx.queue.write_buffer(&ctx.param_buffer, 0, bytemuck::bytes_of(&params));
             let zero = [0u32, 0u32];
             ctx.queue.write_buffer(&ctx.result_buffer, 0, bytemuck::cast_slice(&zero));
             let mut encoder = ctx.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                 label: Some("pow_encoder"),
             });
             {
                 let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                     label: Some("pow_pass"),
                 });
                 pass.set_pipeline(&ctx.pipeline);
                 pass.set_bind_group(0, &bind_group, &[]);
                 pass.dispatch_workgroups(workgroups, 1, 1);
             }
             ctx.queue.submit(Some(encoder.finish()));
             let slice = ctx.result_buffer.slice(..);
             slice
                 .map_async(wgpu::MapMode::Read)
                 .await
                 .map_err(|_| JsValue::from_str("Failed to map result buffer"))?;
             let data = slice.get_mapped_range();
             let result = bytemuck::cast_slice::<u32>(&data);
             if result[0] == 1 {
                 let nonce = result[1];
                 let _ = cb.call1(&JsValue::NULL, &JsValue::from(nonce));
                 ctx.result_buffer.unmap();
                 break;
             }
             ctx.result_buffer.unmap();
             base_nonce = base_nonce.wrapping_add(batch_size);
         }
         Ok(())
     }
     #[cfg(not(feature = "gpu"))]
     {
         let work = work.to_vec();
         let cb = cb.clone();
         spawn_local(async move {
             let mut nonce: u64 = 0;
             while !ABORT_FLAG.load(Ordering::SeqCst) {
                 let mut hasher = blake3::Hasher::new();
                 hasher.update(&work);
                 hasher.update(&nonce.to_le_bytes());
                 let hash = hasher.finalize();
                 let bytes = hash.as_bytes();
                 let h0 = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
                 if h0 <= target {
                     let _ = cb.call1(&JsValue::NULL, &JsValue::from(nonce));
                     break;
                 }
                 nonce = nonce.wrapping_add(1);
             }
         });
         Ok(())
     }
 }

 /// Signal cancellation to mining.
 #[wasm_bindgen]
 pub fn stop() {
     ABORT_FLAG.store(true, Ordering::SeqCst);
 }

 /// Compute standard BLAKE3 hash (32 bytes) of input.
 #[wasm_bindgen]
 pub fn blake3_hash(input: &[u8]) -> Vec<u8> {
     let mut hasher = blake3::Hasher::new();
     hasher.update(input);
     let hash = hasher.finalize();
     hash.as_bytes().to_vec()
 }