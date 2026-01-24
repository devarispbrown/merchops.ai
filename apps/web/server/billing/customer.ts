/**
 * Stripe Customer Management
 *
 * Handles creation and retrieval of Stripe customer records
 * for workspace billing.
 */

import { logger } from '@/server/observability/logger';
import { ExternalServiceError } from '@/server/observability/error-handler';

// @ts-ignore - Stripe types may not be available during build
import Stripe from 'stripe';

/**
 * Initialize Stripe client
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // @ts-ignore - API version type mismatch
  apiVersion: '2024-12-18.acacia',
  typescript: true,
  appInfo: {
    name: 'MerchOps',
    version: '0.1.0',
  },
});

export { stripe };

/**
 * Create a new Stripe customer
 *
 * @param email - Customer email address
 * @param workspaceId - Workspace ID to store in metadata
 * @param name - Optional customer name
 * @returns Stripe Customer object
 */
export async function createStripeCustomer(
  email: string,
  workspaceId: string,
  name?: string
): Promise<Stripe.Customer> {
  try {
    logger.info(
      { workspaceId, email },
      'Creating Stripe customer'
    );

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        workspace_id: workspaceId,
      },
      description: `MerchOps workspace: ${workspaceId}`,
    });

    logger.info(
      {
        workspaceId,
        customerId: customer.id,
        email,
      },
      'Stripe customer created successfully'
    );

    return customer;
  } catch (error) {
    logger.error(
      {
        workspaceId,
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to create Stripe customer'
    );

    throw new ExternalServiceError(
      'Stripe',
      `Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Retrieve a Stripe customer by ID
 *
 * @param customerId - Stripe customer ID
 * @returns Stripe Customer object or null if deleted
 */
export async function getStripeCustomer(
  customerId: string
): Promise<Stripe.Customer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);

    // Customer was deleted
    if (customer.deleted) {
      logger.warn(
        { customerId },
        'Stripe customer was deleted'
      );
      return null;
    }

    return customer as Stripe.Customer;
  } catch (error: any) {
    if (error?.type === 'StripeInvalidRequestError') {
      logger.warn(
        { customerId, error: error?.message },
        'Stripe customer not found'
      );
      return null;
    }

    logger.error(
      {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to retrieve Stripe customer'
    );

    throw new ExternalServiceError(
      'Stripe',
      `Failed to retrieve customer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update a Stripe customer
 *
 * @param customerId - Stripe customer ID
 * @param params - Update parameters
 * @returns Updated Stripe Customer object
 */
export async function updateStripeCustomer(
  customerId: string,
  params: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> {
  try {
    logger.info(
      { customerId, params },
      'Updating Stripe customer'
    );

    const customer = await stripe.customers.update(customerId, params);

    logger.info(
      { customerId },
      'Stripe customer updated successfully'
    );

    return customer;
  } catch (error) {
    logger.error(
      {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to update Stripe customer'
    );

    throw new ExternalServiceError(
      'Stripe',
      `Failed to update customer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Search for a Stripe customer by email
 *
 * @param email - Customer email address
 * @returns Stripe Customer object or null if not found
 */
export async function findStripeCustomerByEmail(
  email: string
): Promise<Stripe.Customer | null> {
  try {
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return null;
    }

    return customers.data[0];
  } catch (error) {
    logger.error(
      {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to search for Stripe customer'
    );

    throw new ExternalServiceError(
      'Stripe',
      `Failed to search for customer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a Stripe customer
 * Note: This permanently deletes the customer and cancels all subscriptions
 *
 * @param customerId - Stripe customer ID
 * @returns Deleted customer confirmation
 */
export async function deleteStripeCustomer(
  customerId: string
): Promise<Stripe.DeletedCustomer> {
  try {
    logger.warn(
      { customerId },
      'Deleting Stripe customer'
    );

    const deleted = await stripe.customers.del(customerId);

    logger.info(
      { customerId },
      'Stripe customer deleted successfully'
    );

    return deleted;
  } catch (error) {
    logger.error(
      {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to delete Stripe customer'
    );

    throw new ExternalServiceError(
      'Stripe',
      `Failed to delete customer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a Stripe checkout session for subscription
 *
 * @param customerId - Stripe customer ID
 * @param priceId - Stripe Price ID
 * @param successUrl - URL to redirect on success
 * @param cancelUrl - URL to redirect on cancel
 * @param metadata - Optional metadata
 * @returns Stripe Checkout Session
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<Stripe.Checkout.Session> {
  try {
    logger.info(
      { customerId, priceId },
      'Creating Stripe checkout session'
    );

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata || {},
      subscription_data: {
        metadata: metadata || {},
      },
    });

    logger.info(
      {
        customerId,
        sessionId: session.id,
      },
      'Stripe checkout session created successfully'
    );

    return session;
  } catch (error) {
    logger.error(
      {
        customerId,
        priceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to create Stripe checkout session'
    );

    throw new ExternalServiceError(
      'Stripe',
      `Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a Stripe billing portal session
 *
 * @param customerId - Stripe customer ID
 * @param returnUrl - URL to return to after managing billing
 * @returns Stripe Billing Portal Session
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  try {
    logger.info(
      { customerId },
      'Creating Stripe billing portal session'
    );

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    logger.info(
      {
        customerId,
        sessionId: session.id,
      },
      'Stripe billing portal session created successfully'
    );

    return session;
  } catch (error) {
    logger.error(
      {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to create Stripe billing portal session'
    );

    throw new ExternalServiceError(
      'Stripe',
      `Failed to create billing portal session: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
