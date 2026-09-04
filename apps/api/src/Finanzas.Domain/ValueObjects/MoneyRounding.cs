namespace Finanzas.Domain.ValueObjects;

/// <summary>
/// Política de redondeo monetario del proyecto (regla financiera 4 del handoff:
/// <c>decimal</c> siempre, con política de redondeo documentada y explícita).
/// </summary>
/// <remarks>
/// <list type="bullet">
///   <item><b>Modo:</b> <see cref="MidpointRounding.AwayFromZero"/> — el clásico
///   "medio hacia arriba" comercial. Se descarta banker's rounding porque el
///   usuario compara contra extractos bancarios que usan medio hacia arriba.</item>
///   <item><b>Escala:</b> las unidades menores de cada moneda
///   (<see cref="Currency.MinorUnits"/>). Un importe nunca se guarda con más
///   decimales de los que la moneda admite.</item>
///   <item><b>Momento:</b> se redondea al construir cada <see cref="Money"/>. Los
///   cálculos intermedios (tasas, prorrateos, intereses) se hacen en
///   <c>decimal</c> sin redondear y solo el resultado se materializa como dinero.</item>
///   <item><b>Reparto:</b> nunca se redondea cada parte por separado; se usa
///   <see cref="Money.Allocate(System.Collections.Generic.IReadOnlyList{decimal})"/>,
///   que reparte por mayor resto y garantiza que la suma de las partes es
///   exactamente el total (no se pierde ni se inventa un centavo).</item>
/// </list>
/// </remarks>
public static class MoneyRounding
{
    /// <summary>Modo de redondeo único del dominio.</summary>
    public const MidpointRounding Mode = MidpointRounding.AwayFromZero;

    /// <summary>Redondea un valor crudo a la escala de una moneda.</summary>
    public static decimal Round(decimal value, Currency currency) =>
        Math.Round(value, currency.MinorUnits, Mode);

    /// <summary>Devuelve <c>10^escala</c> de la moneda.</summary>
    public static decimal ScaleFactor(Currency currency)
    {
        decimal factor = 1m;
        for (var i = 0; i < currency.MinorUnits; i++)
        {
            factor *= 10m;
        }

        return factor;
    }
}
