<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('My Reservations') }}
        </h2>
    </x-slot>

    <div class="py-6">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            @if (session('status'))
                <div class="rounded-md bg-green-100 p-4 text-green-800">{{ session('status') }}</div>
            @endif

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if ($items->count())
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr class="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    <th class="py-3 pe-4">{{ __('Date / Time') }}</th>
                                    <th class="py-3 pe-4">{{ __('Doctor') }}</th>
                                    <th class="py-3 pe-4">{{ __('Checkup') }}</th>
                                    <th class="py-3 pe-4">{{ __('Status') }}</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 text-sm text-gray-700">
                                @foreach ($items as $item)
                                    @php
                                        $statusValue = $item->status instanceof \App\Models\ReservationStatus
                                            ? $item->status->value
                                            : (string) $item->status;
                                    @endphp
                                    <tr>
                                        <td class="py-3 pe-4">
                                            {{ optional($item->starts_at)->format('Y-m-d H:i') }}
                                            @if ($item->ends_at)
                                                <span class="text-gray-500">- {{ $item->ends_at->format('H:i') }}</span>
                                            @endif
                                        </td>
                                        <td class="py-3 pe-4">{{ $item->doctor?->user?->name ?? __('N/A') }}</td>
                                        <td class="py-3 pe-4">{{ $item->checkup?->title ?? __('N/A') }}</td>
                                        <td class="py-3 pe-4">
                                            <span class="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                                                {{ $statusValue }}
                                            </span>
                                        </td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-6">
                        {{ $items->links() }}
                    </div>
                @else
                    <p class="text-gray-600">{{ __('You do not have any reservations yet.') }}</p>
                @endif
            </div>
        </div>
    </div>
</x-app-layout>
