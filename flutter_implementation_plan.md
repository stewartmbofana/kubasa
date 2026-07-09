# Step-by-Step Flutter Implementation Plan — VGV Layered Bloc Architecture

This document details the step-by-step technical plan to rebuild the Kubasa HR Platform in **Flutter (Dart)** following the **Very Good Ventures (VGV) feature-first layered architecture** and using **`flutter_bloc`** for state management.

---

## 🏗️ 1. Project Directory Structure

We will organize the code cleanly by separating concerns into **Data Layer** (providers, repositories, models), **Business Logic Layer** (Blocs/Cubits), and **Presentation Layer** (Widgets/Pages) nested within features or structured globally for shared utilities.

```
lib/
  app/
    view/
      app.dart                # MaterialApp initialization, router config
  core/
    theme/
      app_theme.dart          # Forest Green / Amber theme tokens
    utils/
      db_helpers.dart         # Uuid & sequence helper utilities
  data/
    data_providers/           # Direct Firebase clients
      auth_provider.dart
      firestore_provider.dart
      storage_provider.dart
    repositories/             # Clean domain wrapper APIs
      auth_repository.dart
      candidate_repository.dart
      employer_repository.dart
      job_repository.dart
    models/                   # Dart data serialization classes
      user_model.dart
      candidate_model.dart
      employer_model.dart
      job_model.dart
  features/
    auth/                     # Candidate, Employer, and Admin authentication
      bloc/
        auth_bloc.dart
      view/
        login_page.dart
        register_page.dart
    candidates/               # Candidate profile & job browsing
      bloc/
        candidate_profile_bloc.dart
        candidate_jobs_bloc.dart
      view/
        profile_page.dart
        jobs_page.dart
    employers/                # Employer candidate registry, shortlisting & jobs
      bloc/
        candidate_search_bloc.dart
        employer_jobs_bloc.dart
      view/
        candidates_search_page.dart
        shortlist_page.dart
        jobs_list_page.dart
        post_job_page.dart
    admin/                    # Admin portal approval queue
      bloc/
        admin_dashboard_bloc.dart
      view/
        admin_dashboard_page.dart
```

---

## 🛠️ 2. Core Dependencies (`pubspec.yaml`)

Add `flutter_bloc` and key VGV-recommended tooling packages:

```yaml
dependencies:
  flutter:
    sdk: flutter
  # Firebase Services
  firebase_core: ^3.3.0
  firebase_auth: ^5.1.2
  cloud_firestore: ^5.0.2
  firebase_storage: ^12.0.1
  # Routing
  go_router: ^14.2.0
  # State Management (VGV Standard)
  flutter_bloc: ^8.1.6
  bloc: ^8.1.4
  equatable: ^2.0.5 # Value equality comparison for Bloc States/Events
  # Utilities
  file_picker: ^8.0.0
  lucide_icons: ^0.301.0
  intl: ^0.19.0
  uuid: ^4.3.3
```

---

## 🗄️ 3. Layered Data Implementation

### A. Data Providers
Responsible for raw interaction with the Firebase modular SDKs.
- `auth_provider.dart`: Encapsulates `FirebaseAuth` sign in, sign up, and sign out requests.
- `firestore_provider.dart`: Fetches raw JSON queries from collections (`users`, `candidates`, `employers`, `jobs`, `applications`).
- `storage_provider.dart`: Uploads and downloads PDF bytes for CVs.

### B. Models
Define type-safe serialization templates using factory initializers. Convert Firestore `Timestamp` objects safely to Dart `DateTime` instances.

### C. Repositories
Repositories map raw database collections to domain model entities. higher-level Blocs consume repositories, not providers.
- **`AuthRepository`**:
  ```dart
  class AuthRepository {
    final FirebaseAuthProvider _authProvider;
    final FirestoreProvider _firestoreProvider;
    
    Stream<UserDoc?> get userStream;
    Future<UserDoc> signUpCandidate(String email, String password);
    Future<UserDoc> signUpEmployer(String email, String password, EmployerDoc details);
    Future<void> signOut();
  }
  ```
- **`CandidateRepository`**: Manages profile creation, fetching candidate lists, and PDF CV uploads.
- **`EmployerRepository`**: Manages organization approvals and shortlist arrays.
- **`JobRepository`**: Publishes job listings and processes candidate interest applications.

---

## ⚡ 4. Business Logic Layer (Blocs)

We will use predictable Event-Driven State Machines with `flutter_bloc`.

### Example 1: `AuthBloc` (Global Session State)
- **Events**:
  - `AuthUserChanged`: Dispatched when the firebase auth session updates.
  - `SignOutRequested`: Dispatched on logout.
- **States**:
  - `AuthInitial`: App loading.
  - `Unauthenticated`: Shows Guest login.
  - `Authenticated(UserDoc user)`: Logged in (holds roles for router redirect guidance).

### Example 2: `CandidateJobsBloc` (Job discovery & application)
- **Events**:
  - `LoadJobsRequested`: Fetches all active opportunities.
  - `InterestToggled(String jobId)`: Adds/removes current candidate UID to job subcollection.
- **States**:
  - `JobsLoadInProgress`
  - `JobsLoadSuccess(List<JobDoc> jobs, Set<String> appliedJobIds)`
  - `JobsLoadFailure(String error)`

---

## 🎨 5. Presentation Layer (UI Widgets & Screens)

Ensure strict adherence to visual design tokens (Forest Green, Amber) and VGV's guidelines for widget decoupling.

1. **Routing Registration (`lib/app/view/app.dart`)**:
   Setup the root `MaterialApp` using `GoRouter` as a router builder, injecting global providers like `RepositoryProvider` and `BlocProvider` high up in the widget tree so they are accessible across screens.
2. **Form Spacing & Button Layout Layouts**:
   - Nest form inputs inside a `Column` wrapper with consistent `gap` dividers:
     ```dart
     Column(
       children: [
         const TextFormField(...),
         const SizedBox(height: 20), // Standard Form Section Spacer
         const TextFormField(...),
         const SizedBox(height: 20),
         // Actions row with breathing space
         Row(
           children: [
             Expanded(child: ElevatedButton(...)),
             const SizedBox(width: 16), // Standard Button Spacer
             OutlinedButton(...),
           ],
         )
       ]
     )
     ```

---

## 🧪 6. Verification and Testing

1. **Repository & Provider Unit Tests**: Mock Firebase instances using `mockito` or `fake_cloud_firestore` and write unit tests verifying deserialization.
2. **Bloc Tests**: Use `bloc_test` package to verify state streams:
   ```dart
   blocTest<AuthBloc, AuthState>(
     'emits [Authenticated] when user changes',
     build: () => AuthBloc(authRepository),
     act: (bloc) => bloc.add(AuthUserChanged(mockUser)),
     expect: () => [Authenticated(mockUser)],
   );
   ```
3. **Emulator Integration**: Link the application locally to the Firebase emulators during debug execution.
