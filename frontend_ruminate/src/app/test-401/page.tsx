"use client";

import { authenticatedFetch } from '@/utils/api';

export default function Test401Page() {
  const trigger401 = async () => {
    // This will trigger a 401 error
    await authenticatedFetch('/api/force-401-error');
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <button
        onClick={trigger401}
        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Test 401 Error Handling
      </button>
    </div>
  );
}