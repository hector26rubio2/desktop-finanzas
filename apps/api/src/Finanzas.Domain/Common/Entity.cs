namespace Finanzas.Domain.Common;

/// <summary>
/// Entidad con identidad estable. La igualdad es por tipo + identificador,
/// nunca por valor de sus atributos.
/// </summary>
public abstract class Entity<TId>
    where TId : struct, IEntityId
{
    protected Entity(TId id)
    {
        Guard.Require(
            !id.IsEmpty,
            DomainErrorCodes.RequiredValue,
            $"El identificador de '{GetType().Name}' no puede ser vacío.");
        Id = id;
    }

    public TId Id { get; }

    public sealed override bool Equals(object? obj) =>
        obj is Entity<TId> other && other.GetType() == GetType() && other.Id.Equals(Id);

    public sealed override int GetHashCode() => HashCode.Combine(GetType(), Id);
}

/// <summary>Raíz de agregado: única puerta de entrada a sus invariantes.</summary>
public abstract class AggregateRoot<TId> : Entity<TId>
    where TId : struct, IEntityId
{
    protected AggregateRoot(TId id)
        : base(id)
    {
    }
}

/// <summary>Contrato mínimo de un identificador fuertemente tipado.</summary>
public interface IEntityId
{
    Guid Value { get; }

    bool IsEmpty => Value == Guid.Empty;
}
