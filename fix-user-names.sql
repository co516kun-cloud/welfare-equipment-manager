-- ユーザー名「田中太郎」問題の修正
-- Step 1: 現在のusersテーブルの状況を確認

SELECT id, name, email, role, department FROM public.users;

-- Step 2: 認証ユーザーの情報を確認（可能な場合）
-- SELECT id, email, raw_user_meta_data FROM auth.users;

-- Step 3: 田中太郎を適切な名前に更新

-- 方法1: メールアドレスから自動生成
UPDATE public.users 
SET name = split_part(email, '@', 1)
WHERE name = '田中太郎';

-- 方法2: 手動で実際の名前を設定（推奨）
-- 以下を実際のユーザー情報に合わせて変更してください

-- 例：管理者ユーザー
UPDATE public.users 
SET name = '管理者', role = 'admin' 
WHERE email = 'admin@example.com';

-- 例：一般スタッフ
UPDATE public.users 
SET name = '営業太郎', role = 'staff', department = '営業部'
WHERE email = 'sales@example.com';

-- 例：マネージャー
UPDATE public.users 
SET name = '部長花子', role = 'manager', department = '管理部'
WHERE email = 'manager@example.com';

-- Step 4: 結果を確認
SELECT id, name, email, role, department FROM public.users;

-- Step 5: 新規ユーザー登録時に自動でusersテーブルに連携するトリガー（既存ユーザーには不要）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, department)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'staff',
    '一般'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    email = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーを作成（まだ存在しない場合）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();