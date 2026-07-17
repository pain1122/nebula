<x-app-layout>
  <x-slot name="header"><h2 class="font-semibold text-xl">دسته‌های چکاپ</h2></x-slot>
  <div class="max-w-5xl mx-auto p-4">
    @if(session('status')) <div class="mb-3 p-2 bg-green-100 text-green-800 rounded">{{ session('status') }}</div> @endif
    @if($errors->any())
      <div class="mb-3 p-2 bg-red-100 text-red-800 rounded">
        @foreach($errors->all() as $error) <div>{{ $error }}</div> @endforeach
      </div>
    @endif
    <div class="mb-4"><a href="{{ route('admin.checkup-categories.create') }}" class="px-3 py-2 bg-blue-600 text-white rounded">دسته جدید</a></div>
    <table class="w-full bg-white rounded shadow text-sm">
      <thead><tr class="border-b"><th class="p-2 text-right">نام</th><th class="p-2 text-right">Slug</th><th class="p-2">اقدامات</th></tr></thead>
      <tbody>
        @foreach($items as $it)
          <tr class="border-b">
            <td class="p-2">{{ $it->name }}</td>
            <td class="p-2">{{ $it->slug }}</td>
            <td class="p-2">
              <a class="text-blue-600" href="{{ route('admin.checkup-categories.edit',$it) }}">ویرایش</a>
              <button
                type="button"
                class="text-amber-700 ml-2"
                onclick="document.getElementById('archive-category-{{ $it->id }}').showModal()"
              >بایگانی</button>

              <dialog
                id="archive-category-{{ $it->id }}"
                class="rounded shadow-xl p-0 w-full max-w-lg"
                @if((int) old('source_category_id') === $it->id) open @endif
              >
                <form method="GET" action="{{ route('admin.checkup-categories.archive-confirm', $it) }}" class="p-5 space-y-4">
                  <input type="hidden" name="source_category_id" value="{{ $it->id }}">
                  <h3 class="font-semibold text-lg">تعیین وضعیت چکاپ‌های دسته «{{ $it->name }}»</h3>
                  <p class="text-sm text-gray-700">هیچ چکاپ، رزرو یا پرداختی حذف نمی‌شود. یکی از گزینه‌های زیر را انتخاب کنید.</p>

                  <label class="flex items-start gap-2">
                    <input type="radio" name="checkup_action" value="detach" @checked(old('checkup_action', 'detach') !== 'reassign')>
                    <span>دسته از چکاپ‌ها حذف شود و چکاپ‌ها بدون دسته باقی بمانند.</span>
                  </label>

                  <label class="flex items-start gap-2">
                    <input type="radio" name="checkup_action" value="reassign" @checked(old('checkup_action') === 'reassign')>
                    <span>چکاپ‌ها به دسته دیگری منتقل شوند.</span>
                  </label>

                  <select
                    name="replacement_category_id"
                    class="w-full border rounded p-2"
                    onchange="if (this.value) this.form.querySelector('input[name=checkup_action][value=reassign]').checked = true"
                  >
                    <option value="">انتخاب دسته جایگزین</option>
                    @foreach($replacementCategories->where('id', '!=', $it->id) as $replacement)
                      <option value="{{ $replacement->id }}" @selected((int) old('replacement_category_id') === $replacement->id)>{{ $replacement->name }}</option>
                    @endforeach
                  </select>

                  <div class="flex justify-end gap-3">
                    <button type="button" class="px-4 py-2 border rounded" onclick="this.closest('dialog').close()">انصراف</button>
                    <button type="submit" class="px-4 py-2 bg-amber-600 text-white rounded">ادامه</button>
                  </div>
                </form>
              </dialog>
            </td>
          </tr>
        @endforeach
      </tbody>
    </table>
    <div class="mt-3">{{ $items->links() }}</div>
  </div>
</x-app-layout>
