package com.beez.common;

import java.util.regex.Pattern;

public final class KenyanMobile {
  private static final Pattern VALID_MOBILE = Pattern.compile("^[17][0-9]{8}$");

  private KenyanMobile() {}

  public static String normalize(String input) {
    if (input == null) throw new IllegalArgumentException("Enter a valid Kenyan mobile number.");
    String compact = input.replaceAll("[\\s()-]", "");
    if (compact.startsWith("+254")) compact = compact.substring(4);
    else if (compact.startsWith("254")) compact = compact.substring(3);
    else if (compact.startsWith("0")) compact = compact.substring(1);
    if (!VALID_MOBILE.matcher(compact).matches()) {
      throw new IllegalArgumentException("Enter a valid Kenyan mobile number.");
    }
    return "+254" + compact;
  }
}
