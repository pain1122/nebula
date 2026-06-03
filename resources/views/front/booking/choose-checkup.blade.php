<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('Choose a Checkup') }}
        </h2>
    </x-slot>

    <div class="py-6">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            @if (session('status'))
                <div class="rounded-md bg-green-100 p-4 text-green-800">{{ session('status') }}</div>
            @endif

            <div class="bg-white shadow-sm sm:rounded-lg p-6">
                @if ($checkups->count())
                    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        @foreach ($checkups as $checkup)
                            <article class="rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
                                <div class="text-xs uppercase tracking-wide text-gray-500">
                                    {{ $checkup->category?->name ?? __('Uncategorized') }}
                                </div>
                                <h3 class="text-lg font-semibold text-gray-900">{{ $checkup->title }}</h3>
                                <p class="text-sm text-gray-600 flex-1">
                                    {{ $checkup->description ?: __('No description provided.') }}
                                </p>
                                <div class="text-sm font-medium text-gray-700">
                                    {{ number_format($checkup->price) }} {{ __('IRR') }}
                                </div>
                                <a
                                    href="{{ route('book.choose-doctor', ['checkup' => $checkup]) }}"
                                    class="inline-flex justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                                >
                                    {{ __('Choose Doctor') }}
                                </a>
                            </article>
                        @endforeach
                    </div>

                    <div class="mt-6">
                        {{ $checkups->links() }}
                    </div>
                @else
                    <p class="text-gray-600">{{ __('No checkups found.') }}</p>
                @endif
            </div>
        </div>
    </div>
</x-app-layout>
