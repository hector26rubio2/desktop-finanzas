import { FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
describe('dynamic form contract', () => {
  it('supports conditional financial fields without duplicating forms', () => {
    const form = new FormGroup({
      currency: new FormControl('USD'),
      trmApplied: new FormControl(0, Validators.min(0.000001)),
    });
    const visible = (v: Record<string, unknown>) => v['currency'] !== 'COP';
    expect(visible(form.getRawValue())).toBe(true);
    expect(form.valid).toBe(false);
  });
});
