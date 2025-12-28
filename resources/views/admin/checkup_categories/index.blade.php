<x-app-layout>
  <x-slot name="header"><h2 class="font-semibold text-xl">دسته‌های چکاپ</h2></x-slot>
  <div class="max-w-5xl mx-auto p-4">
    @if(session('status')) <div class="mb-3 p-2 bg-green-100 text-green-800 rounded">{{ session('status') }}</div> @endif
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
              <form action="{{ route('admin.checkup-categories.destroy',$it) }}" method="POST" class="inline" onsubmit="return confirm('حذف شود؟')">
                @csrf @method('DELETE') <button class="text-red-600 ml-2">حذف</button>
              </form>
            </td>
          </tr>
        @endforeach
      </tbody>
    </table>
    <div class="mt-3">{{ $items->links() }}</div>
  </div>
</x-app-layout>
