Feature: Greetings

  Scenario Outline: Welcome user
    Given the greeting target is <name>
    Then the greeting should be Hello <name>

    Scenarios:
      | name  |
      | Alice |
      | Bob   |
