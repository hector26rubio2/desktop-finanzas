export type ViewLoadState = 'loading' | 'error' | 'empty' | 'ready';

export function resolveViewLoadState(isLoading: boolean, hasError: boolean, itemCount: number): ViewLoadState {
  if (isLoading) return 'loading';
  if (hasError) return 'error';
  if (itemCount === 0) return 'empty';
  return 'ready';
}
