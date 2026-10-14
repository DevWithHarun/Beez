package com.beez.voice.spi;

public interface SpeechToText {
  /** Transcribe a bounded, consented recording using the requested locale hint. */
  String transcribe(byte[] audio, String languageTag, String mediaType);
}
