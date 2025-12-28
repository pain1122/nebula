<x-app-layout>
  <x-slot name="header">
    <h2 class="font-semibold text-xl text-gray-800 leading-tight">ویرایش پروفایل پزشک</h2>
  </x-slot>

  <div class="py-6">
    <div class="max-w-3xl mx-auto sm:px-6 lg:px-8">
      @if (session('status'))
        <div class="mb-4 p-3 rounded bg-green-100 text-green-800">{{ session('status') }}</div>
      @endif

      <form method="POST" action="{{ route('doctor.profile.update') }}" class="bg-white p-6 rounded shadow space-y-4">
        @csrf @method('PUT')

        <div>
          <label class="block mb-1">تخصص</label>
          <select name="specialty_id" class="w-full border rounded p-2">
            <option value="">— انتخاب کنید —</option>
            @foreach($specialties as $root)
              @if($root->children->count())
                <optgroup label="{{ $root->name }}">
                  @foreach($root->children as $child)
                    <option value="{{ $child->id }}" @selected(old('specialty_id',$profile->specialty_id)==$child->id)>{{ $child->name }}</option>
                  @endforeach
                </optgroup>
              @else
                <option value="{{ $root->id }}" @selected(old('specialty_id',$profile->specialty_id)==$root->id)>{{ $root->name }}</option>
              @endif
            @endforeach
          </select>
          @error('specialty_id') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block mb-1">تلفن</label>
            <input name="phone" value="{{ old('phone',$profile->phone) }}" class="w-full border rounded p-2" />
            @error('phone') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
          </div>
          <div>
            <label class="block mb-1">سال سابقه</label>
            <input name="experience_years" type="number" min="0" value="{{ old('experience_years',$profile->experience_years) }}" class="w-full border rounded p-2" />
            @error('experience_years') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
          </div>
          <div>
            <label class="block mb-1">تعرفه (ریال)</label>
            <input name="fee" type="number" min="0" value="{{ old('fee',$profile->fee) }}" class="w-full border rounded p-2" />
            @error('fee') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
          </div>
        </div>

        <div>
          <label class="block mb-1">بیو</label>
          <textarea name="bio" rows="4" class="w-full border rounded p-2">{{ old('bio',$profile->bio) }}</textarea>
          @error('bio') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
        </div>

        <div>
          <label class="block mb-1">شیفت‌ها (JSON)</label>
          <textarea name="availability" rows="4" class="w-full border rounded p-2"
            placeholder='[{"day":"sat","slots":[["09:00","12:00"],["14:00","17:00"]]}]'>{{ old('availability', $profile->availability ? json_encode($profile->availability) : '') }}</textarea>
          @error('availability') <div class="text-red-600 text-sm">{{ $message }}</div> @enderror
        </div>

        <div class="flex justify-end">
          <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">ذخیره</button>
        </div>
      </form>
    </div>
  </div>
</x-app-layout>
