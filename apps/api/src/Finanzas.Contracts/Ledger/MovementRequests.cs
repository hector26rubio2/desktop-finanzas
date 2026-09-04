using Finanzas.Contracts.Common;

namespace Finanzas.Contracts.Ledger;

/// <summary>Alta de un movimiento suelto: ingreso, gasto o cargo de tarjeta.</summary>
/// <remarks>
/// <para>Las operaciones de varias patas —transferencia, pago de tarjeta— no se
/// arman con dos de estas peticiones: tienen la suya
/// (<see cref="CreateTransferRequest"/>, <see cref="CreateCardPaymentRequest"/>)
/// para que nazcan en una sola transacción y no exista el estado "salió el
/// dinero pero no entró" (regla financiera 7).</para>
/// <para><see cref="IdempotencyKey"/> permite reintentar sin duplicar: la misma
/// clave devuelve el movimiento ya creado en vez de crear otro.</para>
/// </remarks>
/// <param name="Date">Fecha contable.</param>
/// <param name="Kind">Clase del movimiento.</param>
/// <param name="Effect">Efecto económico; debe ser uno de los admitidos por la clase.</param>
/// <param name="Flow">Flujo de caja; debe ser uno de los admitidos por la clase.</param>
/// <param name="Amount">Importe en la moneda original. Siempre positivo.</param>
/// <param name="Rate">
/// Tasa hacia la moneda base como texto invariante. Si se omite y el importe ya
/// está en moneda base, se aplica la identidad; si la moneda es otra, la
/// petición se rechaza en vez de inventar una conversión.
/// </param>
/// <param name="RateAsOf">Fecha de la tasa. Por omisión, la del movimiento.</param>
/// <param name="Links">Enlaces del movimiento.</param>
/// <param name="Description">Descripción libre.</param>
/// <param name="IdempotencyKey">Clave para reintentar sin duplicar.</param>
public sealed record CreateMovementRequest(
    DateOnly Date,
    MovementKindDto Kind,
    EconomicEffectDto Effect,
    CashFlowDto Flow,
    MoneyDto Amount,
    MovementLinksDto Links,
    string? Rate = null,
    DateOnly? RateAsOf = null,
    string? Description = null,
    string? IdempotencyKey = null);

/// <summary>
/// Transferencia entre cuentas propias: dos patas neutras unidas por una
/// operación.
/// </summary>
/// <remarks>
/// Mover dinero entre cuentas propias jamás es ingreso ni gasto, así que no hay
/// categoría que enviar: el contrato no ofrece el campo en lugar de rechazarlo
/// después.
/// </remarks>
/// <param name="Date">Fecha contable de las dos patas.</param>
/// <param name="Amount">Importe transferido.</param>
/// <param name="SourceAccount">Cuenta de la que sale el dinero.</param>
/// <param name="DestinationAccount">Cuenta a la que entra. Distinta de la anterior.</param>
/// <param name="Description">Descripción libre.</param>
/// <param name="IdempotencyKey">Clave para reintentar sin duplicar.</param>
public sealed record CreateTransferRequest(
    DateOnly Date,
    MoneyDto Amount,
    Guid SourceAccount,
    Guid DestinationAccount,
    string? Description = null,
    string? IdempotencyKey = null);

/// <summary>
/// Pago a una tarjeta de crédito: sale de la cuenta, entra a la tarjeta.
/// </summary>
/// <remarks>
/// Nunca es gasto: el gasto fue la compra. Volver a contarlo al pagar el
/// extracto duplica el efecto económico (regla financiera 2), por eso tampoco
/// admite categoría.
/// </remarks>
/// <param name="Date">Fecha contable de las dos patas.</param>
/// <param name="Amount">Importe pagado.</param>
/// <param name="Account">Cuenta desde la que se paga.</param>
/// <param name="Card">Tarjeta que recibe el pago.</param>
/// <param name="Description">Descripción libre.</param>
/// <param name="IdempotencyKey">Clave para reintentar sin duplicar.</param>
public sealed record CreateCardPaymentRequest(
    DateOnly Date,
    MoneyDto Amount,
    Guid Account,
    Guid Card,
    string? Description = null,
    string? IdempotencyKey = null);

/// <summary>
/// Reclasificación: el único cambio admitido sobre un movimiento existente.
/// </summary>
/// <remarks>
/// Importe, fecha, clase, efecto, flujo y enlaces son inmutables. Corregir
/// cualquiera de ellos se hace con <see cref="ReverseMovementRequest"/> y un
/// movimiento nuevo, que deja rastro (regla financiera 6). Enviar
/// <see cref="Category"/> en nulo quita la categoría, si la clase lo permite.
/// </remarks>
/// <param name="Category">Categoría nueva, o nulo para quitarla.</param>
/// <param name="Description">Descripción nueva, o nulo para borrarla.</param>
public sealed record ReclassifyMovementRequest(Guid? Category, string? Description);

/// <summary>Reverso de un movimiento.</summary>
/// <remarks>
/// No borra ni edita el original: crea un movimiento espejo de signo contrario y
/// marca el original como reversado. La fecha del reverso no puede ser anterior
/// a la del movimiento que anula.
/// </remarks>
/// <param name="Date">Fecha contable del reverso.</param>
/// <param name="Reason">Motivo, que queda como descripción del reverso.</param>
public sealed record ReverseMovementRequest(DateOnly Date, string? Reason = null);
