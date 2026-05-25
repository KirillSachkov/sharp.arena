using System.Text.RegularExpressions;

namespace ArenaApi.Web.Validation;

public static class EmailValidator
{
    public static bool IsValid(string email)
    {
        var regex = new Regex(".+@.+");
        return regex.IsMatch(email);
    }
}