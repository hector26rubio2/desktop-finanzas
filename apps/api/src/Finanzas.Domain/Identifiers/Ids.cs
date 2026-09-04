using Finanzas.Domain.Common;

namespace Finanzas.Domain.Identifiers;

/// <summary>
/// Identificadores fuertemente tipados. Impiden por compilación pasar el id de
/// una cuenta donde se espera el de una tarjeta, defecto habitual cuando todo
/// es <c>string</c> como en el esquema heredado.
/// </summary>
public readonly record struct OrganizationId(Guid Value) : IEntityId
{
    public static OrganizationId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct UserId(Guid Value) : IEntityId
{
    public static UserId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct MembershipId(Guid Value) : IEntityId
{
    public static MembershipId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct AccountId(Guid Value) : IEntityId
{
    public static AccountId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct CategoryId(Guid Value) : IEntityId
{
    public static CategoryId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct MovementId(Guid Value) : IEntityId
{
    public static MovementId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct OperationId(Guid Value) : IEntityId
{
    public static OperationId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct CardId(Guid Value) : IEntityId
{
    public static CardId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct RecurrenceId(Guid Value) : IEntityId
{
    public static RecurrenceId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct PositionId(Guid Value) : IEntityId
{
    public static PositionId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct CounterpartyId(Guid Value) : IEntityId
{
    public static CounterpartyId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct ObligationId(Guid Value) : IEntityId
{
    public static ObligationId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct ObligationEntryId(Guid Value) : IEntityId
{
    public static ObligationEntryId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct SharedPurchaseId(Guid Value) : IEntityId
{
    public static SharedPurchaseId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct SettlementId(Guid Value) : IEntityId
{
    public static SettlementId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}

public readonly record struct ValuationId(Guid Value) : IEntityId
{
    public static ValuationId New() => new(Guid.NewGuid());

    public bool IsEmpty => Value == Guid.Empty;

    public override string ToString() => Value.ToString("D");
}
