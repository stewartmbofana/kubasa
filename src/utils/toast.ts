import { Toast } from '../types';

let addGlobalToast: (message: string, type?: Toast['type']) => void = () => {};

export function showToast(message: string, type: Toast['type'] = 'success') {
  addGlobalToast(message, type);
}

export function registerToastSetter(fn: (message: string, type?: Toast['type']) => void) {
  addGlobalToast = fn;
}
