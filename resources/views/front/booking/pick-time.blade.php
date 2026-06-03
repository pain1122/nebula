<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Pick a Time') }} - {{ $doctor->user?->name ?? __('Doctor') }}
        </h2>
    </x-slot>

    <div class="py-6">
        <div class="max-w-3xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div>
                <a
                    href="{{ route('book.choose-doctor', ['checkup' => $checkup]) }}"
                    class="text-sm text-indigo-600 hover:text-indigo-500"
                >
                    {{ __('Back to doctors') }}
                </a>
            </div>

            <div class="bg-white shadow-sm sm:rounded-lg p-6 space-y-5">
                <div class="text-sm text-gray-700">
                    <div><strong>{{ __('Checkup') }}:</strong> {{ $checkup->title }}</div>
                    <div><strong>{{ __('Doctor') }}:</strong> {{ $doctor->user?->name ?? __('N/A') }}</div>
                    <div><strong>{{ __('Fee') }}:</strong> {{ number_format($doctor->fee) }} {{ __('IRR') }}</div>
                </div>

                @if ($errors->any())
                    <div class="rounded-md bg-red-50 p-4 text-sm text-red-700">
                        <ul class="list-disc ps-5 space-y-1">
                            @foreach ($errors->all() as $error)
                                <li>{{ $error }}</li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                @if (count($slots) === 0)
                    <div class="rounded-md bg-yellow-50 p-4 text-yellow-800">
                        {{ __('No available slots found for the next 7 days.') }}
                    </div>
                @else
                    <form method="POST" action="{{ route('book.store', ['checkup' => $checkup, 'doctor' => $doctor]) }}" class="space-y-4">
                        @csrf

                        <div>
                            <label for="starts_at" class="block text-sm font-medium text-gray-700">{{ __('Available Slots') }}</label>
                            <select
                                id="starts_at"
                                name="starts_at"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                required
                            >
                                @foreach ($slots as $slot)
                                    @php
                                        [$slotStart, $slotEnd] = $slot;
                                    @endphp
                                    <option value="{{ $slotStart->format('Y-m-d\TH:i') }}">
                                        {{ $slotStart->format('Y-m-d H:i') }} - {{ $slotEnd->format('H:i') }}
                                    </option>
                                @endforeach
                            </select>
                        </div>

                        <div>
                            <label for="duration" class="block text-sm font-medium text-gray-700">{{ __('Duration (minutes)') }}</label>
                            <select
                                id="duration"
                                name="duration"
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                required
                            >
                                <option value="30" selected>30</option>
                                <option value="45">45</option>
                                <option value="60">60</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            class="inline-flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                        >
                            {{ __('Confirm Reservation') }}
                        </button>
                    </form>
                @endif
            </div>
        </div>
    </div>
</x-app-layout>
