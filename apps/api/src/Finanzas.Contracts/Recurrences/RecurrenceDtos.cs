using Finanzas.Contracts.Common;
using Finanzas.Contracts.Ledger;

namespace Finanzas.Contracts.Recurrences;

/// <summary>
/// Cada cuánto se repite. Espejo de
/// <c>Finanzas.Domain.Recurrences.RecurrenceFrequency</c>.
/// </summary>
public enum RecurrenceFrequencyDto
{
    Daily = 1,
    Weekly = 2,
    Monthly = 3,
    Yearly = 4,
}

/// <summary>
/// Cuántas patas produce al materializarse. Espejo de
/// <c>Finanzas.Domain.Recurrences.RecurrenceKind</c>.
/// </summary>
public enum RecurrenceKindDto
{
    /// <summary>Una sola pata: ingreso, gasto o compra con tarjeta.</summary>
    SingleMovement = 1,

    /// <summary>Dos patas unidas por una operación: ahorro automático entre cuentas propias.</summary>
    Transfer = 2,
}

/// <summary>Calendario de un recurrente.</summary>
/// <param name="Frequency">Unidad de repetición.</param>
/// <param name="Interval">Cada cuántas unidades se repite.</param>
/// <param name="Start">Primer día en que puede ocurrir.</param>
/// <param name="End">Último día, si tiene fin.</param>
/// <param name="DayOfMonth">Día del mes, en frecuencias mensual y anual.</param>
/// <param name="DayOfWeek">Día de la semana, en frecuencia semanal.</param>
public sealed record RecurrenceScheduleDto(
    RecurrenceFrequencyDto Frequency,
    int Interval,
    DateOnly Start,
    DateOnly? End,
    int? DayOfMonth,
    DayOfWeek? DayOfWeek);

/// <summary>Ocurrencia ya materializada, con lo que produjo en el ledger.</summary>
/// <param name="Occurrence">Fecha de la ocurrencia.</param>
/// <param name="Operation">Operación que agrupa las patas, si son varias.</param>
/// <param name="Movements">Movimientos que nacieron.</param>
public sealed record RecurrenceMaterializationDto(
    DateOnly Occurrence,
    Guid? Operation,
    IReadOnlyList<Guid> Movements);

/// <summary>
/// Recurrente: la plantilla de una operación que se repite. No es un movimiento.
/// </summary>
/// <remarks>
/// <para>Hasta que se materializa no hay nada en el ledger. Una proyección no es
/// una garantía y no se convierte en movimiento sin confirmación explícita
/// (regla financiera 10): la interfaz puede mostrar lo que viene, pero no
/// sumarlo a los saldos.</para>
/// <para><see cref="MaterializedOccurrences"/> es la memoria que hace idempotente
/// la materialización: repetir una fecha ya materializada falla en vez de
/// duplicar el gasto (regla financiera 7).</para>
/// </remarks>
/// <param name="Id">Identificador del recurrente.</param>
/// <param name="Name">Nombre visible.</param>
/// <param name="Kind">Cuántas patas produce.</param>
/// <param name="MovementTemplate">Clase de movimiento que produce, si es de una sola pata.</param>
/// <param name="Amount">Importe de cada ocurrencia.</param>
/// <param name="Target">Enlaces que heredarán los movimientos, si es de una sola pata.</param>
/// <param name="SourceAccount">Cuenta de origen, si es transferencia.</param>
/// <param name="DestinationAccount">Cuenta de destino, si es transferencia.</param>
/// <param name="Schedule">Calendario.</param>
/// <param name="IsActive">Sigue generando ocurrencias.</param>
/// <param name="NextOccurrence">Próxima fecha pendiente, si queda alguna.</param>
/// <param name="MaterializedOccurrences">Fechas ya materializadas, en orden.</param>
/// <param name="CreatedAt">Instante de creación.</param>
public sealed record RecurrenceDto(
    Guid Id,
    string Name,
    RecurrenceKindDto Kind,
    MovementKindDto? MovementTemplate,
    MoneyDto Amount,
    MovementLinksDto Target,
    Guid? SourceAccount,
    Guid? DestinationAccount,
    RecurrenceScheduleDto Schedule,
    bool IsActive,
    DateOnly? NextOccurrence,
    IReadOnlyList<DateOnly> MaterializedOccurrences,
    DateTimeOffset CreatedAt);

/// <summary>Alta de un recurrente de una sola pata.</summary>
/// <param name="Name">Nombre visible.</param>
/// <param name="MovementTemplate">Clase de movimiento que producirá.</param>
/// <param name="Amount">Importe de cada ocurrencia.</param>
/// <param name="Target">Enlaces que heredarán los movimientos.</param>
/// <param name="Schedule">Calendario.</param>
public sealed record CreateRecurrenceRequest(
    string Name,
    MovementKindDto MovementTemplate,
    MoneyDto Amount,
    MovementLinksDto Target,
    RecurrenceScheduleDto Schedule);

/// <summary>Alta de una transferencia recurrente: el ahorro automático.</summary>
/// <remarks>
/// Materializa dos patas neutras y una operación en la misma transacción, así
/// que no existe el estado "salió el dinero pero no entró". Origen y destino
/// deben ser cuentas distintas.
/// </remarks>
/// <param name="Name">Nombre visible.</param>
/// <param name="Amount">Importe de cada ocurrencia.</param>
/// <param name="SourceAccount">Cuenta de la que sale el dinero.</param>
/// <param name="DestinationAccount">Cuenta a la que entra.</param>
/// <param name="Schedule">Calendario.</param>
public sealed record CreateRecurringTransferRequest(
    string Name,
    MoneyDto Amount,
    Guid SourceAccount,
    Guid DestinationAccount,
    RecurrenceScheduleDto Schedule);

/// <summary>Edición de un recurrente.</summary>
/// <remarks>
/// Cambiar importe o calendario rige de aquí en adelante: las ocurrencias ya
/// materializadas son movimientos reales y no se reescriben (regla financiera 8).
/// </remarks>
/// <param name="Name">Nombre visible.</param>
/// <param name="Amount">Importe de cada ocurrencia.</param>
/// <param name="Schedule">Calendario.</param>
/// <param name="IsActive">Activo o en pausa.</param>
public sealed record UpdateRecurrenceRequest(
    string Name,
    MoneyDto Amount,
    RecurrenceScheduleDto Schedule,
    bool IsActive);

/// <summary>Materialización explícita de una ocurrencia.</summary>
/// <remarks>
/// Es la confirmación que exige la regla financiera 10: nada llega al ledger por
/// el mero paso del tiempo. Repetir una fecha ya materializada es un error, no
/// un duplicado.
/// </remarks>
/// <param name="Occurrence">Fecha que se materializa.</param>
/// <param name="Amount">Importe real, si difiere del de la plantilla.</param>
/// <param name="IdempotencyKey">Clave para reintentar sin duplicar.</param>
public sealed record MaterializeRecurrenceRequest(
    DateOnly Occurrence,
    MoneyDto? Amount = null,
    string? IdempotencyKey = null);

/// <summary>Ocurrencia futura proyectada de un recurrente.</summary>
/// <remarks>
/// <b>No es un movimiento</b> y no tiene identificador de ledger: es lo que
/// pasará si nadie interviene. El calendario la pinta distinto de lo ya
/// ocurrido, y ningún saldo la incluye.
/// </remarks>
/// <param name="Recurrence">Recurrente que la produce.</param>
/// <param name="Occurrence">Fecha proyectada.</param>
/// <param name="Amount">Importe previsto.</param>
/// <param name="Kind">Cuántas patas producirá.</param>
public sealed record ProjectedOccurrenceDto(
    LinkRefDto Recurrence,
    DateOnly Occurrence,
    MoneyDto Amount,
    RecurrenceKindDto Kind);
