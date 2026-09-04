using Finanzas.Contracts.Accounts;
using Finanzas.Contracts.Cards;
using Finanzas.Contracts.Categories;
using Finanzas.Contracts.Common;
using Finanzas.Contracts.Ledger;

namespace Finanzas.Contracts.Reporting;

/// <summary>Resultado de un periodo: ingreso, gasto y neto.</summary>
/// <remarks>
/// Solo entra lo que tiene efecto económico. Transferencias, pagos de tarjeta,
/// capital de préstamos y aportes a inversiones son neutros y no aparecen aquí,
/// aunque hayan movido dinero: contarlos sería registrar dos veces el mismo
/// efecto (regla financiera 2).
/// </remarks>
/// <param name="Income">Ingresos del periodo, en moneda base.</param>
/// <param name="Expense">Gastos del periodo, en moneda base.</param>
/// <param name="Net">Ingresos menos gastos.</param>
/// <param name="Period">Periodo cubierto.</param>
public sealed record PeriodResultDto(
    MoneyDto Income,
    MoneyDto Expense,
    MoneyDto Net,
    DateRangeDto Period);

/// <summary>Total de una categoría en un periodo.</summary>
/// <param name="Category">Categoría totalizada.</param>
/// <param name="Type">Lado del resultado al que pertenece.</param>
/// <param name="Total">Total acumulado, en moneda base.</param>
/// <param name="MovementCount">Movimientos que lo componen.</param>
public sealed record CategoryTotalDto(
    LinkRefDto Category,
    CategoryTypeDto Type,
    MoneyDto Total,
    int MovementCount);

/// <summary>
/// Cifras de la pantalla de inicio a una fecha.
/// </summary>
/// <remarks>
/// Todo lo que hay aquí es proyección del ledger, calculada por el servidor. El
/// cliente no suma saldos ni deduce deudas por su cuenta: dos implementaciones
/// de la misma cuenta terminan discrepando, y en dinero eso es un defecto.
/// </remarks>
/// <param name="Period">Resultado del periodo consultado.</param>
/// <param name="Accounts">Saldo de cada cuenta activa.</param>
/// <param name="Cards">Situación de cada tarjeta activa.</param>
/// <param name="TopCategories">Categorías con mayor total en el periodo.</param>
/// <param name="AsOf">Fecha del corte.</param>
public sealed record DashboardDto(
    PeriodResultDto Period,
    IReadOnlyList<AccountBalanceDto> Accounts,
    IReadOnlyList<CardStatusDto> Cards,
    IReadOnlyList<CategoryTotalDto> TopCategories,
    DateOnly AsOf);
