export interface UploadResult {
  url: string;
  path: string;
  fileId?: string;
  error?: string;
}

export async function uploadFile(
  file: File,
  orderId: string,
  fileType: 'statement' | 'previous',
  userId?: string | null,
  guestEmail?: string | null,
  guestName?: string | null
): Promise<UploadResult> {
  console.log('🚀 Starting file upload via API...');
  console.log('📁 File:', file.name, 'Size:', file.size, 'bytes');
  console.log('📦 Order ID:', orderId);
  console.log('🏷️ File type:', fileType);

  // Validate file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    console.error('❌ File too large:', file.size, 'bytes');
    return {
      url: '',
      path: '',
      error: 'Filen är för stor. Maximal filstorlek är 10MB.',
    };
  }
  console.log('✅ File size OK');

  // Validate file type
  const allowedTypes = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ];

  console.log('🔍 File MIME type:', file.type);
  if (!allowedTypes.includes(file.type)) {
    console.error('❌ Invalid file type:', file.type);
    return {
      url: '',
      path: '',
      error: `Ogiltigt filformat. Tillåtna format: PDF, Excel, CSV`,
    };
  }
  console.log('✅ File type OK');

  try {
    console.log('📤 Sending file to upload API...');

    // Create FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('orderId', orderId);
    formData.append('fileType', fileType);
    if (userId) {
      formData.append('userId', userId);
    }
    if (guestEmail) {
      formData.append('guestEmail', guestEmail);
    }
    if (guestName) {
      formData.append('guestName', guestName);
    }

    // Upload via API route with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('📤 API response status:', response.status);

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Upload API error:', data.error);
      return {
        url: '',
        path: '',
        error: data.error || 'Uppladdning misslyckades',
      };
    }

    console.log('✅ Upload complete!');
    console.log('🔗 URL:', data.url);
    console.log('📂 Path:', data.path);

    return {
      url: data.url,
      path: data.path,
      fileId: data.fileId,
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Upload timeout');
      return {
        url: '',
        path: '',
        error: 'Uppladdningen tog för lång tid. Försök igen.',
      };
    }

    console.error('❌ Unexpected upload error:', error);
    return {
      url: '',
      path: '',
      error: 'Ett oväntat fel uppstod vid uppladdning.',
    };
  }
}

export function generateOrderId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
