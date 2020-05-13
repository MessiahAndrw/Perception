// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include "perception/debug.h"
#include "perception/messages.h"

void main() {
	size_t senders_pid, message_id, param1, param2, param3, param4, param5;

	while(perception::SleepUntilMessage(&senders_pid, &message_id, &param1, &param2,
		&param3, &param4, &param5)) {
		perception::DebugPrinterSingleton << "3: Slept and received " << message_id << " from " << senders_pid << ": "
			<< param1 << "," << param2 << "," << param3 << "," << param4 << "," << param5 << '\n';
	}
}
