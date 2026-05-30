using Reqnroll;
using Xunit;

namespace MinimalBdd.StepDefinitions;

[Binding]
public sealed class SmokeSteps
{
    private bool _ready;

    [Given("the system is ready")]
    public void GivenTheSystemIsReady()
    {
        _ready = true;
    }

    [Then("the smoke check should succeed")]
    public void ThenTheSmokeCheckShouldSucceed()
    {
        Assert.True(_ready);
    }
}

[Binding]
public sealed class CalculatorSteps
{
    private readonly List<int> _operands = [];

    [Given("I have entered {int} into the calculator")]
    public void GivenIHaveEnteredIntoTheCalculator(int number)
    {
        _operands.Add(number);
    }

    [When("I press add")]
    public void WhenIPressAdd()
    {
        // evaluated in Then
    }

    [Then("the result should be {int} on the screen")]
    public void ThenTheResultShouldBeOnTheScreen(int expected)
    {
        var actual = _operands.Sum();
        Assert.Equal(expected, actual);
    }
}
