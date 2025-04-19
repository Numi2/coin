"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={
        "block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 " +
        className
      }
      {...props}
    />
  );
}