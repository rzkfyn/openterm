import { describe, it, expect } from 'vitest';
import { getLanguageExtension } from '../CodeMirrorEditor';

describe('getLanguageExtension', () => {
  it('detects JSON files', () => {
    expect(getLanguageExtension('package.json')).not.toBeNull();
  });

  it('detects JavaScript and TypeScript files', () => {
    expect(getLanguageExtension('index.ts')).not.toBeNull();
    expect(getLanguageExtension('App.tsx')).not.toBeNull();
    expect(getLanguageExtension('main.js')).not.toBeNull();
    expect(getLanguageExtension('Component.jsx')).not.toBeNull();
  });

  it('detects Python files', () => {
    expect(getLanguageExtension('script.py')).not.toBeNull();
  });

  it('detects HTML and CSS files', () => {
    expect(getLanguageExtension('index.html')).not.toBeNull();
    expect(getLanguageExtension('styles.css')).not.toBeNull();
  });

  it('detects YAML files', () => {
    expect(getLanguageExtension('docker-compose.yml')).not.toBeNull();
    expect(getLanguageExtension('config.yaml')).not.toBeNull();
  });

  it('detects Rust files', () => {
    expect(getLanguageExtension('main.rs')).not.toBeNull();
  });

  it('detects SQL and Markdown files', () => {
    expect(getLanguageExtension('schema.sql')).not.toBeNull();
    expect(getLanguageExtension('README.md')).not.toBeNull();
  });
  it('detects Shell scripts and env files', () => {
    expect(getLanguageExtension('molect.sh')).not.toBeNull();
    expect(getLanguageExtension('deploy.bash')).not.toBeNull();
    expect(getLanguageExtension('setup.zsh')).not.toBeNull();
    expect(getLanguageExtension('.env')).not.toBeNull();
    expect(getLanguageExtension('.env.production')).not.toBeNull();
    expect(getLanguageExtension('.bashrc')).not.toBeNull();
  });

  it('detects Dockerfile, TOML, Nginx, and config files', () => {
    expect(getLanguageExtension('Dockerfile')).not.toBeNull();
    expect(getLanguageExtension('dockerfile.dev')).not.toBeNull();
    expect(getLanguageExtension('Cargo.toml')).not.toBeNull();
    expect(getLanguageExtension('nginx.conf')).not.toBeNull();
    expect(getLanguageExtension('app.ini')).not.toBeNull();
    expect(getLanguageExtension('system.properties')).not.toBeNull();
  });

  it('detects languages via shebang fallback', () => {
    expect(getLanguageExtension('executable_no_ext', '#!/bin/bash\necho 1')).not.toBeNull();
    expect(getLanguageExtension('py_script', '#!/usr/bin/env python\nprint(1)')).not.toBeNull();
  });

  it('returns null for unknown extensions without shebang', () => {
    expect(getLanguageExtension('unknown.xyz')).toBeNull();
    expect(getLanguageExtension('noextension')).toBeNull();
  });
});
