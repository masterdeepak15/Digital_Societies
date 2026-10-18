import { applyServerChange } from './applyServerChange';

function fakes(stored: string | null) {
  let current = stored;
  return {
    deps: {
      getOrigin: jest.fn(async () => current),
      setOrigin: jest.fn(async (o: string) => { current = o; }),
      clearTokens: jest.fn(async () => {}),
      logout: jest.fn(() => {}),
    },
    now: () => current,
  };
}

describe('applyServerChange', () => {
  it('saves a different origin and signs the user out of the old server', async () => {
    const f = fakes('https://old.example');
    const result = await applyServerChange('https://new.example', f.deps);
    expect(result).toEqual({ changed: true });
    expect(f.deps.setOrigin).toHaveBeenCalledWith('https://new.example');
    expect(f.deps.clearTokens).toHaveBeenCalledTimes(1);
    expect(f.deps.logout).toHaveBeenCalledTimes(1);
    expect(f.now()).toBe('https://new.example');
  });

  it('does nothing when the origin is unchanged', async () => {
    const f = fakes('https://same.example');
    const result = await applyServerChange('https://same.example', f.deps);
    expect(result).toEqual({ changed: false });
    expect(f.deps.setOrigin).not.toHaveBeenCalled();
    expect(f.deps.clearTokens).not.toHaveBeenCalled();
    expect(f.deps.logout).not.toHaveBeenCalled();
  });

  it('treats the first-ever save as a change and clears any leftover session', async () => {
    const f = fakes(null);
    const result = await applyServerChange('https://first.example', f.deps);
    expect(result).toEqual({ changed: true });
    expect(f.deps.setOrigin).toHaveBeenCalledWith('https://first.example');
    expect(f.deps.clearTokens).toHaveBeenCalledTimes(1);
    expect(f.deps.logout).toHaveBeenCalledTimes(1);
  });

  it('clears the old session before saving the new origin so old tokens never reach the new server', async () => {
    const f = fakes('https://old.example');
    const order: string[] = [];
    f.deps.setOrigin.mockImplementation(async () => { order.push('set'); });
    f.deps.clearTokens.mockImplementation(async () => { order.push('clear'); });
    await applyServerChange('https://new.example', f.deps);
    expect(order).toEqual(['clear', 'set']);
  });
});
