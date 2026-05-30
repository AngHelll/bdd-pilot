@bdd-pilot-smoke
Feature: Smoke
  Minimal Reqnroll + xUnit scenarios for BDD Pilot CI smoke.

  @smoke
  Scenario: System is ready
    Given the system is ready
    Then the smoke check should succeed

  Scenario Outline: Add two numbers
    Given I have entered <first> into the calculator
    And I have entered <second> into the calculator
    When I press add
    Then the result should be <result> on the screen

    Examples:
      | first | second | result |
      | 1     | 2      | 3      |
      | 5     | 7      | 12     |
