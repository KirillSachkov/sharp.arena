using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ArenaApi.Web.Utils;

/// <summary>Converts arbitrary titles into URL-safe slugs.</summary>
public static partial class Slugifier
{
    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonAlphanumeric();

    public static string Slugify(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        string ascii = RemoveDiacritics(input.Trim().ToLowerInvariant());
        return NonAlphanumeric().Replace(ascii, "-").Trim('-');
    }

    private static string RemoveDiacritics(string text)
    {
        string normalized = text.Normalize(NormalizationForm.FormD);
        StringBuilder sb = new(normalized.Length);
        foreach (char c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            {
                sb.Append(c);
            }
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}