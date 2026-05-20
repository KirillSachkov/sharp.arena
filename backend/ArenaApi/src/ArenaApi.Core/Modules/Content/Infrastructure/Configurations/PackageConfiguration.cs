using ArenaApi.Core.Modules.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArenaApi.Core.Modules.Content.Infrastructure.Configurations;

internal sealed class PackageConfiguration : IEntityTypeConfiguration<Package>
{
    public void Configure(EntityTypeBuilder<Package> b)
    {
        b.ToTable("packages");

        b.HasKey(p => p.Id);
        b.Property(p => p.Id).HasColumnName("id");

        b.Property(p => p.Slug).HasColumnName("slug").HasMaxLength(120).IsRequired();
        b.HasIndex(p => p.Slug).IsUnique();

        b.Property(p => p.Title).HasColumnName("title").HasMaxLength(200).IsRequired();
        b.Property(p => p.CreatedAt).HasColumnName("created_at").IsRequired();

        // Domain events are not persisted.
        b.Ignore(p => p.DomainEvents);
    }
}
