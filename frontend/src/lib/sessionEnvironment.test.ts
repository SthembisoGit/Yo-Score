import { describe, expect, it } from 'vitest';
import { detectSessionDeviceClass } from './sessionEnvironment';

describe('detectSessionDeviceClass', () => {
  it('marks phone user agents as mobile', () => {
    expect(
      detectSessionDeviceClass(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        390,
      ),
    ).toBe('mobile');
  });

  it('marks tablet user agents as tablet', () => {
    expect(
      detectSessionDeviceClass(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        1024,
      ),
    ).toBe('tablet');
  });

  it('marks wide desktop browsers as desktop', () => {
    expect(
      detectSessionDeviceClass(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
        1600,
      ),
    ).toBe('desktop');
  });

  it('marks standard laptop widths as laptop', () => {
    expect(
      detectSessionDeviceClass(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
        1366,
      ),
    ).toBe('laptop');
  });
});

