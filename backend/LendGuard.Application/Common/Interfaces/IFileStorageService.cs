using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace LendGuard.Application.Common.Interfaces;

public interface IFileStorageService
{
    Task<(string filePath, string fileHash)> SaveUploadAsync(Stream fileStream, string originalFileName, CancellationToken cancellationToken = default);
    Task<Stream> OpenReadAsync(string filePath, CancellationToken cancellationToken = default);
    Task<string> SaveExportAsync(string fileName, byte[] content, CancellationToken cancellationToken = default);
}
