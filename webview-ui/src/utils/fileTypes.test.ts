import { describe, it, expect } from 'vitest';
import { isBinaryFile, isCodeLanguage, BINARY_EXTENSIONS, CODE_LANGUAGES } from './fileTypes';

describe('fileTypes', () => {
  describe('isBinaryFile', () => {
    it('should identify image files as binary', () => {
      expect(isBinaryFile('image.png')).toBe(true);
      expect(isBinaryFile('photo.jpg')).toBe(true);
      expect(isBinaryFile('pic.webp')).toBe(true);
      expect(isBinaryFile('raw.arw')).toBe(true);
    });

    it('should NOT identify SVG files as binary (SVG is text-based XML)', () => {
      expect(isBinaryFile('icon.svg')).toBe(false);
    });

    it('should identify font files as binary', () => {
      expect(isBinaryFile('font.woff2')).toBe(true);
      expect(isBinaryFile('font.ttf')).toBe(true);
      expect(isBinaryFile('icon.eot')).toBe(true);
    });

    it('should identify archive files as binary', () => {
      expect(isBinaryFile('package.zip')).toBe(true);
      expect(isBinaryFile('data.tar')).toBe(true);
      expect(isBinaryFile('backup.7z')).toBe(true);
    });

    it('should identify compiled files as binary', () => {
      expect(isBinaryFile('module.wasm')).toBe(true);
      expect(isBinaryFile('app.exe')).toBe(true);
      expect(isBinaryFile('lib.dll')).toBe(true);
      expect(isBinaryFile('main.pyc')).toBe(true);
    });

    it('should identify video/audio files as binary', () => {
      expect(isBinaryFile('movie.mp4')).toBe(true);
      expect(isBinaryFile('song.mp3')).toBe(true);
      expect(isBinaryFile('audio.flac')).toBe(true);
    });

    it('should identify VM/disk image files as binary', () => {
      expect(isBinaryFile('disk.vhdx')).toBe(true);
      expect(isBinaryFile('vm.vmdk')).toBe(true);
      expect(isBinaryFile('installer.iso')).toBe(true);
    });

    it('should not identify code files as binary', () => {
      expect(isBinaryFile('app.tsx')).toBe(false);
      expect(isBinaryFile('main.py')).toBe(false);
      expect(isBinaryFile('config.json')).toBe(false);
      expect(isBinaryFile('style.css')).toBe(false);
      expect(isBinaryFile('README.md')).toBe(false);
    });

    it('should handle case insensitivity', () => {
      expect(isBinaryFile('IMAGE.PNG')).toBe(true);
      expect(isBinaryFile('Photo.JPG')).toBe(true);
      expect(isBinaryFile('FONT.WOFF2')).toBe(true);
    });

    it('should handle files without extensions', () => {
      expect(isBinaryFile('Dockerfile')).toBe(false);
      expect(isBinaryFile('Makefile')).toBe(false);
    });

    it('should handle paths with directories', () => {
      expect(isBinaryFile('assets/images/logo.png')).toBe(true);
      expect(isBinaryFile('src/components/App.tsx')).toBe(false);
    });
  });

  describe('isCodeLanguage', () => {
    it('should identify programming languages as code', () => {
      expect(isCodeLanguage('TypeScript')).toBe(true);
      expect(isCodeLanguage('JavaScript')).toBe(true);
      expect(isCodeLanguage('Python')).toBe(true);
      expect(isCodeLanguage('Rust')).toBe(true);
      expect(isCodeLanguage('Go')).toBe(true);
    });

    it('should identify web languages as code', () => {
      expect(isCodeLanguage('HTML')).toBe(true);
      expect(isCodeLanguage('CSS')).toBe(true);
      expect(isCodeLanguage('SCSS')).toBe(true);
      expect(isCodeLanguage('Vue')).toBe(true);
      expect(isCodeLanguage('Svelte')).toBe(true);
    });

    it('should identify systems languages as code', () => {
      expect(isCodeLanguage('C')).toBe(true);
      expect(isCodeLanguage('C++')).toBe(true);
      expect(isCodeLanguage('Rust')).toBe(true);
      expect(isCodeLanguage('Zig')).toBe(true);
    });

    it('should not identify config/data languages as code', () => {
      expect(isCodeLanguage('JSON')).toBe(false);
      expect(isCodeLanguage('YAML')).toBe(false);
      expect(isCodeLanguage('XML')).toBe(false);
      expect(isCodeLanguage('TOML')).toBe(false);
    });

    it('should not identify documentation languages as code', () => {
      expect(isCodeLanguage('Markdown')).toBe(false);
      expect(isCodeLanguage('MDX')).toBe(false);
      expect(isCodeLanguage('Plain Text')).toBe(false);
    });

    it('should handle undefined/unknown', () => {
      expect(isCodeLanguage(undefined)).toBe(false);
      expect(isCodeLanguage('Unknown')).toBe(false);
    });
  });

  describe('BINARY_EXTENSIONS set', () => {
    it('should contain common binary extensions', () => {
      expect(BINARY_EXTENSIONS.has('.png')).toBe(true);
      expect(BINARY_EXTENSIONS.has('.pdf')).toBe(true);
      expect(BINARY_EXTENSIONS.has('.wasm')).toBe(true);
    });

    it('should not contain code extensions', () => {
      expect(BINARY_EXTENSIONS.has('.ts')).toBe(false);
      expect(BINARY_EXTENSIONS.has('.py')).toBe(false);
      expect(BINARY_EXTENSIONS.has('.js')).toBe(false);
    });
  });

  describe('CODE_LANGUAGES set', () => {
    it('should contain common programming languages', () => {
      expect(CODE_LANGUAGES.has('TypeScript')).toBe(true);
      expect(CODE_LANGUAGES.has('Python')).toBe(true);
      expect(CODE_LANGUAGES.has('Rust')).toBe(true);
    });

    it('should contain infrastructure as code languages', () => {
      expect(CODE_LANGUAGES.has('Terraform')).toBe(true);
      expect(CODE_LANGUAGES.has('Dockerfile')).toBe(true);
    });
  });
});
