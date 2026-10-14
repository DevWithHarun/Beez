package com.beez;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BeezApplication {
  public static void main(String[] args) {
    SpringApplication.run(BeezApplication.class, args);
  }
}
