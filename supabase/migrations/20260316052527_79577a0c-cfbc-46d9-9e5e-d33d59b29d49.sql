-- Habilita extensões necessárias para agendamento de funções no banco
create extension if not exists pg_cron;
create extension if not exists pg_net;