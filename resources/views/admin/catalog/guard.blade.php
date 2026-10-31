@php
    $catalogGuard = app(\App\Services\CatalogAdministration::class)->context($kind, $catalogId, auth()->user());
@endphp
<input type="hidden" name="expected_revision" value="{{ $catalogGuard['revision'] }}">
@if($needsReason ?? true)
    <label class="block mb-1">دلیل تغییر
        <textarea name="reason" required maxlength="1000" class="w-full border rounded p-2">{{ old('reason') }}</textarea>
    </label>
@endif
<label class="block"><input type="checkbox" name="confirmed" value="1" required> تغییر و حفظ سوابق را تأیید می‌کنم.</label>
@error('expected_revision') <div role="alert">{{ $message }}</div> @enderror
