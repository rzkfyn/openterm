import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseOsc7Path,
  formatSafeCdCommand,
  SyncCoordinator,
} from '../syncUtils';

describe('syncUtils', () => {
  describe('parseOsc7Path', () => {
    it('parses file:// URL with hostname', () => {
      expect(parseOsc7Path('file://remote-host/var/log')).toBe('/var/log');
    });

    it('parses URL with encoded spaces and characters', () => {
      expect(parseOsc7Path('file://localhost/home/user/my%20folder/test%231')).toBe(
        '/home/user/my folder/test#1'
      );
    });

    it('parses plain POSIX absolute path', () => {
      expect(parseOsc7Path('/etc/nginx/conf.d')).toBe('/etc/nginx/conf.d');
    });

    it('returns null for empty or invalid input', () => {
      expect(parseOsc7Path('')).toBeNull();
      expect(parseOsc7Path('   ')).toBeNull();
      expect(parseOsc7Path('file://')).toBeNull();
    });
  });

  describe('formatSafeCdCommand', () => {
    it('wraps path in single quotes with cd --', () => {
      expect(formatSafeCdCommand('/var/log')).toBe("cd -- '/var/log'\r");
    });

    it('safely escapes single quotes in path', () => {
      expect(formatSafeCdCommand("/var/user's folder")).toBe("cd -- '/var/user'\\''s folder'\r");
    });

    it('handles special characters safely without expansion risk', () => {
      expect(formatSafeCdCommand('/var/test$dir/`whoami`/"hello"!')).toBe(
        "cd -- '/var/test$dir/`whoami`/\"hello\"!'\r"
      );
    });
  });

  describe('SyncCoordinator loop prevention', () => {
    let coordinator: SyncCoordinator;

    beforeEach(() => {
      coordinator = new SyncCoordinator();
    });

    it('allows initial sync', () => {
      expect(coordinator.shouldSync('/var/log', 'terminal', 1000)).toBe(true);
    });

    it('blocks duplicate bounce within 2000ms window', () => {
      expect(coordinator.shouldSync('/var/log', 'terminal', 1000)).toBe(true);
      expect(coordinator.shouldSync('/var/log', 'sftp', 1050)).toBe(false);
      expect(coordinator.shouldSync('/var/log/', 'sftp', 1500)).toBe(false);
    });

    it('allows sync to a different directory immediately', () => {
      expect(coordinator.shouldSync('/var/log', 'terminal', 1000)).toBe(true);
      expect(coordinator.shouldSync('/etc/nginx', 'sftp', 1050)).toBe(true);
    });

    it('allows same directory after 2000ms window has passed', () => {
      expect(coordinator.shouldSync('/var/log', 'terminal', 1000)).toBe(true);
      expect(coordinator.shouldSync('/var/log', 'sftp', 3500)).toBe(true);
    });
  });
});
