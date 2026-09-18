import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

import { NewConnectionModal } from '../NewConnectionModal';

describe('NewConnectionModal Responsive 2-Column Layout (#37)', () => {
  const defaultProps = {
    isOpen: true,
    mode: 'new' as const,
    editingConnection: null,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onSaveAndConnect: vi.fn(),
    isLoading: false,
    error: null,
  };

  it('renders modal card container with max-w-3xl, viewport height constraint, and dialog role', () => {
    const html = renderToStaticMarkup(React.createElement(NewConnectionModal, defaultProps));
    expect(html).toBeTruthy();

    // Modal card container must use max-w-3xl, flex-col, max-h-[85vh], role="dialog"
    const cardMatch = html.match(/<div class="([^"]*max-w-3xl[^"]*)"[^>]*role="dialog"/);
    expect(cardMatch).not.toBeNull();
    const cardClasses = cardMatch![1].split(/\s+/);

    expect(cardClasses).toContain('flex');
    expect(cardClasses).toContain('flex-col');
    expect(cardClasses).toContain('max-h-[85vh]');
    expect(cardClasses).toContain('overflow-hidden');
  });

  it('renders responsive 2-column grid with distinct left and right child columns', () => {
    const html = renderToStaticMarkup(React.createElement(NewConnectionModal, defaultProps));

    // Form body must contain responsive grid with two distinct column containers
    const gridMatch = html.match(/<div class="([^"]*grid[^"]*grid-cols-1[^"]*md:grid-cols-2[^"]*)">([\s\S]*?)<\/form>/);
    expect(gridMatch).not.toBeNull();
    const gridContent = gridMatch![2];

    // Left column contains Profile Name, Host, Authentication
    expect(gridContent).toMatch(/<div class="space-y-3.5">[\s\S]*?Profile Name[\s\S]*?Host \/ IP Target[\s\S]*?Authentication Method/);

    // Right column contains Bookmarks and Quick Commands
    expect(gridContent).toMatch(/<div class="space-y-4">[\s\S]*?SFTP Directory Bookmarks[\s\S]*?Quick Commands/);
  });

  it('includes select-text in input fields for selectable text inside modal', () => {
    const html = renderToStaticMarkup(React.createElement(NewConnectionModal, defaultProps));
    expect(html).toMatch(/<input[^>]*class="[^"]*select-text[^"]*"/);
  });

  it('renders header and footer with shrink-0', () => {
    const html = renderToStaticMarkup(React.createElement(NewConnectionModal, defaultProps));

    // Header pinned
    const headerMatch = html.match(/<div class="([^"]*border-b[^"]*)"[^>]*><div><h3[^>]*>New Connection Profile/);
    expect(headerMatch).not.toBeNull();
    expect(headerMatch![1].split(/\s+/)).toContain('shrink-0');

    // Footer pinned
    const footerMatch = html.match(/<div class="([^"]*border-t[^"]*)"[^>]*><button[^>]*>Cancel/);
    expect(footerMatch).not.toBeNull();
    expect(footerMatch![1].split(/\s+/)).toContain('shrink-0');
  });

  it('retains responsive 2-column layout in edit mode', () => {
    const editProps = {
      ...defaultProps,
      mode: 'edit' as const,
      editingConnection: {
        id: 'conn-1',
        name: 'Existing Server',
        host: '192.168.1.100',
        port: 22,
        username: 'admin',
        authType: 'password' as const,
        createdAt: 1000,
        updatedAt: 1000,
      },
    };

    const html = renderToStaticMarkup(React.createElement(NewConnectionModal, editProps));
    expect(html).toContain('Edit Connection Profile');

    const cardMatch = html.match(/<div class="([^"]*max-w-3xl[^"]*)"/);
    expect(cardMatch).not.toBeNull();
    expect(html).toMatch(/grid-cols-1[^"]*md:grid-cols-2/);
  });
});
