import { expect, test } from '@playwright/test';
import { actAs, TEACHER } from './dev-user';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=',
  'base64',
);

test('sube y elimina el avatar desde el perfil', async ({ page }) => {
  await actAs(page, TEACHER);
  await page.goto('/profile');

  const upload = page.getByLabel('Foto de perfil en PNG, JPG o WebP');
  await upload.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG });
  await expect(page.getByText('Foto de perfil actualizada')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitar foto' })).toBeVisible();

  await page.getByRole('button', { name: 'Quitar foto' }).click();
  await expect(page.getByText('Foto de perfil eliminada')).toBeVisible();
});
