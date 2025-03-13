"use server";

import { z } from "zod";
import postgres from "postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });
const FormSchema = z.object({
	id: z.string(),
	customerId: z.string({
		invalid_type_error: "Please select a customer.",
	}),
	amount: z.coerce.number().gt(0, { message: "Please enter an amount greater than $0." }),
	status: z.enum(["pending", "paid"], {
		invalid_type_error: "Please select an invoice status.",
	}),
	date: z.string(),
});
const CreateInvoice = FormSchema.omit({ id: true, date: true });
export type State = {
	errors?: {
		customerId?: string[];
		amount?: string[];
		status?: string[];
	};
	message?: string | null;
};
export async function createInvoices(prevState: State, formData: FormData) {
	// console.log("formData:", formData);
	// const rawFormData = Object.fromEntries(formData.entries());
	/**
    {
      '$ACTION_ID_4033c67cf8238c8a6d002b1e16dbb0a4d4fdd94e64': '',
      customerId: '3958dc9e-742f-4377-85e9-fec4b6a6442a',
      amount: '666',
      status: 'paid'
    }
   */
	console.log("prevState:", prevState);
	const validatedFields = CreateInvoice.safeParse({
		customerId: formData.get("customerId"),
		amount: formData.get("amount"),
		status: formData.get("status"),
	});
	console.log("validatedFields:", validatedFields);
	if (!validatedFields.success) {
		return {
			errors: validatedFields.error.flatten().fieldErrors,
			message: "Missing Fields. Failed to Create Invoice.",
		};
	}
	const { customerId, amount, status } = validatedFields.data;
	// It's usually good practice to store monetary values in cents in your database to eliminate JavaScript floating-point errors and ensure greater accuracy.
	const amountInCents = amount * 100;
	const date = new Date().toISOString().split("T")[0];
	try {
		await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
	} catch (error) {
		console.log("【Create Invoice Action Error】", error);
		return { message: "Database Error: Failed to Create Invoice." };
	}
	revalidatePath("/dashboard/invoices");
	redirect("/dashboard/invoices");
}
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
export async function updateInvoice(id: string, prevState: State, formData: FormData) {
	console.log("prevState:", prevState);
	const validatedFields = UpdateInvoice.safeParse({
		customerId: formData.get("customerId"),
		amount: formData.get("amount"),
		status: formData.get("status"),
	});
	if (!validatedFields.success) {
		return {
			errors: validatedFields.error.flatten().fieldErrors,
			message: "Missing Fields. Failed to Update Invoice.",
		};
	}
	const { customerId, amount, status } = validatedFields.data;
	const amountInCents = amount * 100;
	try {
		await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
	} catch (error) {
		console.log("【Update Invoice Action Error】", error);
		return { message: "Database Error: Failed to Update Invoice." };
	}
	revalidatePath("/dashboard/invoices");
	redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
	// TODO: delete the test code below
	throw new Error("Failed to Delete Invoice");
	await sql`DELETE FROM invoices WHERE id = ${id}`;
	revalidatePath("/dashboard/invoices");
}

export async function authenticate(prevState: string | undefined, formData: FormData) {
	console.log("【actions:authenticate】prevState:", prevState);
	try {
		await signIn("credentials", formData);
	} catch (error) {
		console.log("【actions:authenticate】error:", error);
		if (error instanceof AuthError) {
			switch (error.type) {
				case "CredentialsSignin":
					return "Invalid credentials.";
				default:
					return "Something went wrong.";
			}
		}
		console.log("throw error");
		throw error;
	}
}
