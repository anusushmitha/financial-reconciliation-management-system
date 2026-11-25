using System;
using LendGuard.Domain.Entities;

namespace LendGuard.Application.Common.Interfaces;

public interface IJwtService
{
    (string token, DateTimeOffset expiresAt) GenerateToken(User user);
}
