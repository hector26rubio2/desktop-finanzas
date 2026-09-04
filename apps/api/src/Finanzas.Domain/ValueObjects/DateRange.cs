using Finanzas.Domain.Common;

namespace Finanzas.Domain.ValueObjects;

/// <summary>
/// Rango de fechas cerrado por ambos extremos: <c>[Start, End]</c>. Se usa para
/// ciclos de tarjeta, periodos de liquidación, vigencias de recurrentes y
/// ventanas de reporte.
/// </summary>
public readonly record struct DateRange : IComparable<DateRange>
{
    private DateRange(DateOnly start, DateOnly end)
    {
        Start = start;
        End = end;
    }

    public DateOnly Start { get; }

    public DateOnly End { get; }

    /// <summary>Número de días incluidos (ambos extremos cuentan).</summary>
    public int DayCount => End.DayNumber - Start.DayNumber + 1;

    public bool IsSingleDay => Start == End;

    public static DateRange Create(DateOnly start, DateOnly end)
    {
        Guard.Require(
            start <= end,
            DomainErrorCodes.InvalidDateRange,
            $"El inicio ({start:yyyy-MM-dd}) no puede ser posterior al fin ({end:yyyy-MM-dd}).");
        return new DateRange(start, end);
    }

    public static DateRange SingleDay(DateOnly day) => new(day, day);

    /// <summary>Mes calendario completo; respeta años bisiestos.</summary>
    public static DateRange Month(int year, int month)
    {
        Guard.InRange(month, 1, 12, nameof(month));
        var start = new DateOnly(year, month, 1);
        var end = new DateOnly(year, month, DateTime.DaysInMonth(year, month));
        return new DateRange(start, end);
    }

    public bool Contains(DateOnly date) => date >= Start && date <= End;

    public bool Overlaps(DateRange other) => Start <= other.End && other.Start <= End;

    /// <summary>Intersección, o <c>null</c> si no se solapan.</summary>
    public DateRange? Intersect(DateRange other)
    {
        if (!Overlaps(other))
        {
            return null;
        }

        var start = Start > other.Start ? Start : other.Start;
        var end = End < other.End ? End : other.End;
        return new DateRange(start, end);
    }

    public int CompareTo(DateRange other)
    {
        var byStart = Start.CompareTo(other.Start);
        return byStart != 0 ? byStart : End.CompareTo(other.End);
    }

    public override string ToString() => $"{Start:yyyy-MM-dd}..{End:yyyy-MM-dd}";
}
