export interface User {
  id:    string;
  name:  string;
  email: string;
  role:  string;
}

export const USERS: User[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin'  },
  { id: '2', name: 'Bob Smith',     email: 'bob@example.com',   role: 'Editor' },
  { id: '3', name: 'Carol White',   email: 'carol@example.com', role: 'Viewer' },
];

export function findUser(id: string): User | undefined {
  return USERS.find(u => u.id === id);
}
