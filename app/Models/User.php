<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\AccountState;
use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, HasUlids, Notifiable;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'account_state' => AccountState::Active->value,
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        // اگر name را نگه می‌داری (برای سازگاری قدیمی)
        'name',
        'email',
        'password',

        // فیلدهای جدید
        'first_name',
        'last_name',
        'phone',
        'birth_date',
        'NID',
        'city',
        'country',
        'zip_code',
        'bio',
        'patient_status',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'birth_date' => 'date',
            'account_state' => AccountState::class,
            'account_state_changed_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * @return list<string>
     */
    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function permitsAuthentication(): bool
    {
        return $this->account_state->permitsAuthentication();
    }


    protected $guard_name = 'sanctum';
    public function doctorProfile()
    {
        return $this->hasOne(DoctorProfile::class);
    }

    public function reservations()
    {
        return $this->hasMany(\App\Models\Reservation::class);
    }

    public function profile()
    {
        return $this->hasOne(\App\Models\UserProfile::class);
    }

    public function isRootAdmin(): bool
    {
        return $this->hasRole(UserRole::RootAdmin->value);
    }

    public function canAccessAdminPanel(): bool
    {
        return $this->hasAnyRole(UserRole::adminPanelValues());
    }

    public function canAccessDevtools(): bool
    {
        return $this->isRootAdmin();
    }

}
