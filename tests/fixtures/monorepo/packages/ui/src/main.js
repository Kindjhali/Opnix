import { createApp } from 'vue';

export function boot(root) {
  const message = `Bootstrapped ${root}`;
  return createApp({ data: () => ({ message }) });
}
