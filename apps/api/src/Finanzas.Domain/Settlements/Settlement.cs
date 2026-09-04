using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Obligations;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Settlements;

/// <summary>Una entrada usada en la liquidación, con su origen trazable.</summary>
public sealed record SettlementLine(
    ObligationId Obligation,
    ObligationEntryId Entry,
    ObligationEntryType Type,
    DateOnly Date,
    Money PrincipalDelta,
    Money InterestDelta)
{
    public Money TotalDelta => PrincipalDelta + InterestDelta;
}

/// <summary>
/// Liquidación por persona y periodo (§W11). Es <b>inmutable</b>: no tiene un
/// solo método que la modifique.
/// </summary>
/// <remarks>
/// <b>Regla financiera 9.</b> Conserva versión de fórmula
/// (<see cref="FormulaVersion"/>), fecha de corte (<see cref="CutOff"/>) y las
/// entradas exactas utilizadas (<see cref="Lines"/>, con el id de cada asiento).
/// Recalcularla con otras reglas produce una liquidación nueva; la emitida no
/// cambia. Emitirla tampoco genera ingreso ni gasto: es un informe, no un
/// hecho económico (regla financiera 2).
/// </remarks>
public sealed class Settlement : AggregateRoot<SettlementId>
{
    private readonly List<SettlementLine> _lines;

    private Settlement(
        SettlementId id,
        CounterpartyId counterparty,
        DateRange period,
        DateOnly cutOff,
        Currency currency,
        Money openingBalance,
        List<SettlementLine> lines,
        int formulaVersion,
        DateTimeOffset issuedAt)
        : base(id)
    {
        Counterparty = counterparty;
        Period = period;
        CutOff = cutOff;
        Currency = currency;
        OpeningBalance = openingBalance;
        _lines = lines;
        FormulaVersion = formulaVersion;
        IssuedAt = issuedAt;
    }

    public CounterpartyId Counterparty { get; }

    public DateRange Period { get; }

    /// <summary>Fecha de corte: nada posterior entra en esta liquidación.</summary>
    public DateOnly CutOff { get; }

    public Currency Currency { get; }

    /// <summary>Saldo al iniciar el periodo.</summary>
    public Money OpeningBalance { get; }

    /// <summary>Versión de las fórmulas con las que se calculó.</summary>
    public int FormulaVersion { get; }

    public DateTimeOffset IssuedAt { get; }

    public IReadOnlyList<SettlementLine> Lines => _lines;

    public Money Charges => Sum(_lines
        .Where(line => line.Type is ObligationEntryType.Disbursement or ObligationEntryType.Charge)
        .Select(line => line.PrincipalDelta));

    public Money Interest => Sum(_lines
        .Where(line => line.Type == ObligationEntryType.Interest)
        .Select(line => line.InterestDelta));

    /// <summary>Total abonado en el periodo, en positivo.</summary>
    public Money Payments => Sum(_lines
        .Where(line => line.Type == ObligationEntryType.Payment)
        .Select(line => line.TotalDelta)).Negate();

    public Money Adjustments => Sum(_lines
        .Where(line => line.Type is ObligationEntryType.Adjustment or ObligationEntryType.Reversal)
        .Select(line => line.TotalDelta));

    /// <summary>Saldo al corte: apertura más el efecto de todas las entradas.</summary>
    public Money ClosingBalance =>
        OpeningBalance + Sum(_lines.Select(line => line.TotalDelta));

    public static Settlement Issue(
        SettlementId id,
        CounterpartyId counterparty,
        DateRange period,
        DateOnly cutOff,
        Currency currency,
        Money openingBalance,
        IEnumerable<SettlementLine> lines,
        int formulaVersion,
        DateTimeOffset issuedAt)
    {
        Guard.NotNull(currency);
        Guard.NotNull(openingBalance);
        Guard.Require(
            openingBalance.Currency == currency,
            DomainErrorCodes.CurrencyMismatch,
            $"El saldo inicial está en {openingBalance.Currency.Code} y la liquidación en {currency.Code}.");

        Guard.Require(
            period.Contains(cutOff),
            DomainErrorCodes.InvalidDateRange,
            $"La fecha de corte {cutOff:yyyy-MM-dd} debe caer dentro del periodo {period}.");

        Guard.Require(
            formulaVersion >= 1,
            DomainErrorCodes.OutOfRange,
            "La versión de fórmula debe ser al menos 1.");

        var materialized = lines.ToList();

        foreach (var line in materialized)
        {
            Guard.Require(
                line.PrincipalDelta.Currency == currency && line.InterestDelta.Currency == currency,
                DomainErrorCodes.CurrencyMismatch,
                $"La entrada {line.Entry} no está en {currency.Code}; una liquidación no mezcla monedas.");

            Guard.Require(
                period.Contains(line.Date) && line.Date <= cutOff,
                DomainErrorCodes.SettlementLineOutOfPeriod,
                $"La entrada {line.Entry} ({line.Date:yyyy-MM-dd}) queda fuera del periodo {period} o del corte {cutOff:yyyy-MM-dd}.");
        }

        Guard.Require(
            materialized.Select(line => line.Entry).Distinct().Count() == materialized.Count,
            DomainErrorCodes.InvariantViolation,
            "Una liquidación no puede usar dos veces el mismo asiento.");

        return new Settlement(
            id,
            counterparty,
            period,
            cutOff,
            currency,
            openingBalance,
            materialized,
            formulaVersion,
            issuedAt);
    }

    /// <summary>
    /// Comprueba el cuadre del informe: apertura + cargos + intereses − abonos +
    /// ajustes = saldo al corte.
    /// </summary>
    public void EnsureBalanced()
    {
        var expected = OpeningBalance + Charges + Interest - Payments + Adjustments;
        Guard.Require(
            expected == ClosingBalance,
            DomainErrorCodes.SettlementTotalsMismatch,
            $"La liquidación no cuadra: desglose {expected} frente a saldo {ClosingBalance}.");
    }

    private Money Sum(IEnumerable<Money> amounts) => Money.Sum(amounts, Currency);

    public override string ToString() =>
        $"Liquidación v{FormulaVersion} {Period} corte {CutOff:yyyy-MM-dd}: {ClosingBalance}";
}
