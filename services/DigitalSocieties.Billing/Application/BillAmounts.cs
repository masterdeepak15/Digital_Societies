using System.Globalization;
using DigitalSocieties.Shared.Contracts;

namespace DigitalSocieties.Billing.Application;

/// <summary>What a bill is for, once the society's GST setting is applied.</summary>
public static class BillAmounts
{
    /// <summary>The maintenance in rupees becomes the bill amount: plus GST when the society charges it, and a note for the bill's description.</summary>
    public static (decimal Amount, string Note) For(decimal maintenanceRupees, SocietySettings rules)
    {
        if (!rules.GstEnabled || rules.GstPercent <= 0) return (maintenanceRupees, string.Empty);
        var gst = Math.Round(maintenanceRupees * rules.GstPercent / 100m, 2, MidpointRounding.AwayFromZero);
        var note = string.Create(CultureInfo.InvariantCulture, $" (incl. GST {rules.GstPercent:0.##}%, GSTIN {rules.GstNumber.Trim()})");
        return (maintenanceRupees + gst, note);
    }
}
