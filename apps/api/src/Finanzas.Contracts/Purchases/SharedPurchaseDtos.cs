using Finanzas.Contracts.Common;
using Finanzas.Contracts.Ledger;

namespace Finanzas.Contracts.Purchases;

/// <summary>
/// Sobre qué se calcula la parte de una persona. Espejo de
/// <c>Finanzas.Domain.Purchases.ShareBasis</c>.
/// </summary>
public enum ShareBasisDto
{
    /// <summary>La compra completa es de esa persona.</summary>
    Full = 1,

    Percentage = 2,
    FixedAmount = 3,
}

/// <summary>Parte asignada a una persona.</summary>
/// <param name="Counterparty">Persona a la que se asigna.</param>
/// <param name="Basis">Sobre qué se calcula la parte.</param>
/// <param name="Percent">Porcentaje, si la base es porcentual.</param>
/// <param name="FixedAmount">Importe fijo, si la base es un importe.</param>
/// <param name="Obligation">Obligación donde quedó el cargo, una vez creada.</param>
public sealed record PurchaseShareDto(
    LinkRefDto Counterparty,
    ShareBasisDto Basis,
    PercentageDto? Percent,
    MoneyDto? FixedAmount,
    Guid? Obligation);

/// <summary>Parte ya resuelta a dinero.</summary>
/// <param name="Share">Definición de la que sale.</param>
/// <param name="Amount">Importe que le corresponde.</param>
/// <param name="RoundingAdjustment">
/// Ajuste que absorbió esta parte para que la suma cuadre. En pesos, donde no
/// hay centavos, el reparto es en unidades enteras y alguien tiene que
/// quedarse con el peso sobrante: aquí se ve quién.
/// </param>
public sealed record ResolvedShareDto(
    PurchaseShareDto Share,
    MoneyDto Amount,
    MoneyDto RoundingAdjustment);

/// <summary>Reparto completo de una compra.</summary>
/// <remarks>
/// <see cref="HolderPortion"/> nunca desaparece ni se vuelve negativa: si la
/// suma de las partes excede el total, el reparto se rechaza. Y asignar una
/// compra no reduce la deuda con el emisor (regla financiera 3): lo que nace es
/// una cuenta por cobrar por persona.
/// </remarks>
/// <param name="Shares">Partes resueltas, una por persona.</param>
/// <param name="AssignedTotal">Suma de lo asignado a otras personas.</param>
/// <param name="HolderPortion">Lo que queda a cargo del titular.</param>
/// <param name="RoundingAdjustment">Ajuste total por redondeo.</param>
public sealed record PurchaseAllocationDto(
    IReadOnlyList<ResolvedShareDto> Shares,
    MoneyDto AssignedTotal,
    MoneyDto HolderPortion,
    MoneyDto RoundingAdjustment);

/// <summary>Compra con tarjeta asignada total o parcialmente a otras personas.</summary>
/// <param name="Id">Identificador de la compra compartida.</param>
/// <param name="PurchaseMovement">Movimiento de compra que la origina.</param>
/// <param name="Card">Tarjeta con la que se pagó.</param>
/// <param name="Date">Fecha de la compra.</param>
/// <param name="Total">Importe total de la compra.</param>
/// <param name="Description">Descripción libre.</param>
/// <param name="Allocation">Reparto vigente, ya resuelto a dinero.</param>
/// <param name="CreatedAt">Instante de creación.</param>
public sealed record SharedPurchaseDto(
    Guid Id,
    Guid PurchaseMovement,
    LinkRefDto Card,
    DateOnly Date,
    MoneyDto Total,
    string? Description,
    PurchaseAllocationDto Allocation,
    DateTimeOffset CreatedAt);

/// <summary>Alta de una compra compartida sobre un movimiento de compra existente.</summary>
/// <param name="PurchaseMovement">Movimiento de compra con tarjeta que se reparte.</param>
/// <param name="Shares">Partes que se asignan.</param>
/// <param name="Description">Descripción libre.</param>
public sealed record CreateSharedPurchaseRequest(
    Guid PurchaseMovement,
    IReadOnlyList<AssignShareRequest> Shares,
    string? Description = null);

/// <summary>Asignación de una parte a una persona.</summary>
/// <remarks>
/// Exactamente uno de <see cref="Percent"/> y <see cref="FixedAmount"/> según la
/// base elegida; con <see cref="ShareBasisDto.Full"/> no se envía ninguno.
/// </remarks>
/// <param name="Counterparty">Persona a la que se asigna.</param>
/// <param name="Basis">Sobre qué se calcula la parte.</param>
/// <param name="Percent">Porcentaje, si la base es porcentual.</param>
/// <param name="FixedAmount">Importe fijo, si la base es un importe.</param>
public sealed record AssignShareRequest(
    Guid Counterparty,
    ShareBasisDto Basis,
    PercentageDto? Percent = null,
    MoneyDto? FixedAmount = null);
