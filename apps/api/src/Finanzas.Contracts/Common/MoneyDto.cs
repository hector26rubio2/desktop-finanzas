namespace Finanzas.Contracts.Common;

/// <summary>
/// Importe monetario en el transporte. El importe viaja como
/// <see cref="string"/>, nunca como número JSON.
/// </summary>
/// <remarks>
/// <para><b>Por qué texto.</b> El <c>number</c> de JSON es un binario de doble
/// precisión: 0,1 + 0,2 no da 0,3 y una cifra grande en pesos pierde unidades
/// al pasar por él. El backend trabaja en <c>decimal</c> (decisión de
/// <c>HANDOFF.md</c> §1) y el contrato no puede deshacer esa garantía en el
/// último metro. El cliente recibe el texto exacto y decide si lo formatea o
/// lo lleva a su propio decimal.</para>
/// <para><b>Formato.</b> Cultura invariante, punto como separador decimal, sin
/// separador de miles, signo menos delante si es negativo y tantos decimales
/// como unidades menores tenga la moneda: <c>"1500000"</c> en COP —que usa 0
/// decimales— y <c>"12.34"</c> en USD. La escala es exacta, así que
/// <c>"12.3"</c> o <c>"12.340"</c> en USD son valores mal formados.</para>
/// <para><b>Moneda.</b> Código ISO de tres letras en mayúsculas. El número de
/// decimales de cada código lo publica <see cref="CurrencyDto"/>: el cliente
/// no lo deduce ni lo codifica a mano.</para>
/// </remarks>
/// <param name="Amount">Importe en cultura invariante con la escala de la moneda.</param>
/// <param name="Currency">Código ISO 4217 en mayúsculas.</param>
public sealed record MoneyDto(string Amount, string Currency);

/// <summary>
/// Importe con su moneda original, la tasa aplicada y su equivalente en moneda
/// base. Los tres viajan juntos porque separarlos permite que el cliente sume
/// monedas distintas sin conversión explícita (regla financiera 5).
/// </summary>
/// <param name="Original">Importe en la moneda en que ocurrió el hecho.</param>
/// <param name="Base">Equivalente en la moneda base del perfil.</param>
/// <param name="Rate">
/// Tasa aplicada, también como texto en cultura invariante: es un decimal de
/// alta precisión y un <c>number</c> JSON lo redondearía.
/// </param>
/// <param name="RateAsOf">Fecha de la tasa.</param>
public sealed record ConvertedMoneyDto(
    MoneyDto Original,
    MoneyDto Base,
    string Rate,
    DateOnly RateAsOf);

/// <summary>
/// Moneda del catálogo. El cliente formatea con <see cref="MinorUnits"/> en vez
/// de asumir dos decimales.
/// </summary>
/// <remarks>
/// <c>COP</c> se publica con <b>0</b> decimales por decisión del proyecto, no
/// por ISO 4217: el uso cotidiano colombiano no maneja centavos y las cifras
/// deben cuadrar contra extractos reales.
/// </remarks>
/// <param name="Code">Código ISO 4217 en mayúsculas.</param>
/// <param name="MinorUnits">Decimales con los que se opera la moneda.</param>
/// <param name="IsBase">Es la moneda base del perfil.</param>
public sealed record CurrencyDto(string Code, int MinorUnits, bool IsBase);

/// <summary>Porcentaje o tasa. Texto por la misma razón que el dinero.</summary>
/// <param name="Rate">Tasa en tanto por uno: <c>"0.0225"</c> es 2,25 %.</param>
public sealed record PercentageDto(string Rate);
