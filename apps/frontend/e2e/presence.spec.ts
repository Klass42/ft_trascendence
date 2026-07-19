import { test, expect } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';

/**
 * A6b — Friends presence, live.
 *
 * Runs as the seeded teacher (VITE_DEV_USER_ID=user-diego-001), who is an
 * ACCEPTED friend of Lucía (seed). The navbar friends widget lists Lucía; we
 * then open a real Socket.io connection AS Lucía (from Node, straight to the
 * gateway) and assert the widget flips her to "En línea" live, then back to
 * "Desconectado" when her socket closes. This exercises the full path:
 * gateway presence broadcast → browser socket → PresenceProvider → widget.
 */

const BACKEND = 'http://localhost:3000';
const LUCIA = 'user-lucia-001';

function connectAs(userId: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BACKEND, {
      auth: { userId },
      transports: ['websocket'],
      reconnection: false,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('socket connect timeout')), 5000);
  });
}

test.describe('A6b — friends presence', () => {
  test('friend going online/offline flips the navbar widget live', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    // Open the friends dropdown (trigger labelled with the online count).
    await page.getByRole('button', { name: /Amigos en línea/ }).click();

    // Lucía is listed and starts offline.
    await expect(page.getByText('Lucía Molina')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Desconectado')).toBeVisible();

    // Lucía connects → the widget shows her online, live.
    const lucia = await connectAs(LUCIA);
    await expect(page.getByText('En línea')).toBeVisible({ timeout: 8000 });

    // Lucía disconnects → back to offline.
    lucia.close();
    await expect(page.getByText('Desconectado')).toBeVisible({ timeout: 8000 });
  });
});
